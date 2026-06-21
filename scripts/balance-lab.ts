import { cpus } from "node:os";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import type { SimulationConfig } from "../src/types";
import { DEFAULT_MONTHS, DEFAULT_SEEDS, runBalanceAnalysis, type BalanceAnalysisPayload } from "./balance-shared";
import {
  buildBalanceLabCandidates,
  expandEconomicCandidates,
  scoreBalancePayload,
  type BalanceCandidateDefinition,
  type BalanceObjectiveBreakdown,
} from "./balance-lab-shared";

interface LabStageSettings {
  months: number;
  seeds: number;
}

interface BalanceLabEvaluation {
  candidate: BalanceCandidateDefinition;
  objective: BalanceObjectiveBreakdown;
  payload: BalanceAnalysisPayload;
  stage: "coarse" | "refine";
}

interface BalanceLabReport {
  generatedAt: string;
  candidateCount: number;
  workerCount: number;
  coarse: LabStageSettings & { topCount: number };
  refine: LabStageSettings;
  baseline: BalanceLabEvaluation;
  best: BalanceLabEvaluation;
  topCandidates: BalanceLabEvaluation[];
  recommendation: {
    shouldApply: boolean;
    improvementVsBaselinePercent: number;
    candidateId: string;
    override: Partial<SimulationConfig>;
    reason: string;
  };
}

interface WorkerRequest {
  candidate: BalanceCandidateDefinition;
  stage: "coarse" | "refine";
  months: number;
  seeds: number;
}

interface WorkerResponse {
  candidate: BalanceCandidateDefinition;
  stage: "coarse" | "refine";
  payload: BalanceAnalysisPayload;
  objective: BalanceObjectiveBreakdown;
}

if (isMainThread) {
  void main();
} else {
  runWorker(workerData as WorkerRequest);
}

async function main(): Promise<void> {
  const candidatePool = buildBalanceLabCandidates();
  const coarse: LabStageSettings & { topCount: number } = {
    months: readIntegerEnv("BALANCE_LAB_COARSE_MONTHS", 36),
    seeds: readIntegerEnv("BALANCE_LAB_COARSE_SEEDS", 8),
    topCount: readIntegerEnv("BALANCE_LAB_TOP", 10),
  };
  const refine: LabStageSettings = {
    months: readIntegerEnv("BALANCE_LAB_REFINE_MONTHS", DEFAULT_MONTHS),
    seeds: readIntegerEnv("BALANCE_LAB_REFINE_SEEDS", DEFAULT_SEEDS),
  };
  const workerCount = resolveWorkerCount(readIntegerEnv("BALANCE_LAB_WORKERS", 0));

  const coarseResults = await evaluateCandidateBatch(
    candidatePool,
    { months: coarse.months, seeds: coarse.seeds },
    "coarse",
    workerCount
  );
  const topCandidates = coarseResults
    .slice()
    .sort((left, right) => left.objective.total - right.objective.total)
    .slice(0, coarse.topCount);
  const baselineCandidate = requireCandidate(candidatePool, "baseline");
  const refineCandidates = expandEconomicCandidates(
    ensureBaselineCandidate(
      topCandidates.map((entry) => entry.candidate),
      baselineCandidate
    )
  );
  const refinedResults = await evaluateCandidateBatch(
    refineCandidates,
    refine,
    "refine",
    workerCount
  );
  const sortedRefined = refinedResults
    .slice()
    .sort((left, right) => left.objective.total - right.objective.total);
  const baseline = requireEvaluation(sortedRefined, "baseline");
  const report: BalanceLabReport = {
    generatedAt: new Date().toISOString(),
    candidateCount: candidatePool.length,
    workerCount,
    coarse,
    refine,
    baseline,
    best: sortedRefined[0] ?? baseline,
    topCandidates: sortedRefined.slice(0, Math.max(5, coarse.topCount)),
    recommendation: buildRecommendation(sortedRefined[0] ?? baseline, baseline),
  };

  console.log(JSON.stringify(report, null, 2));
}

function runWorker(request: WorkerRequest): void {
  try {
    const payload = runBalanceAnalysis({
      months: request.months,
      seeds: request.seeds,
      configOverride: request.candidate.override,
    });
    const objective = scoreBalancePayload(payload);
    const response: WorkerResponse = {
      candidate: request.candidate,
      stage: request.stage,
      payload,
      objective,
    };
    parentPort?.postMessage(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Balance lab worker failed for ${request.candidate.id}: ${message}`);
  }
}

async function evaluateCandidateBatch(
  candidates: BalanceCandidateDefinition[],
  settings: LabStageSettings,
  stage: "coarse" | "refine",
  workerCount: number
): Promise<BalanceLabEvaluation[]> {
  const evaluations: BalanceLabEvaluation[] = [];
  const queue = candidates.slice();
  let activeWorkers = 0;

  return new Promise((resolve, reject) => {
    const pump = (): void => {
      if (queue.length === 0 && activeWorkers === 0) {
        resolve(evaluations);
        return;
      }

      while (activeWorkers < workerCount && queue.length > 0) {
        const candidate = queue.shift();
        if (!candidate) {
          break;
        }

        activeWorkers += 1;
        const worker = new Worker(__filename, {
          workerData: {
            candidate,
            stage,
            months: settings.months,
            seeds: settings.seeds,
          } satisfies WorkerRequest,
        });

        worker.once("message", (response: WorkerResponse) => {
          evaluations.push({
            candidate: response.candidate,
            objective: response.objective,
            payload: response.payload,
            stage: response.stage,
          });
        });
        worker.once("error", (error) => {
          reject(error);
        });
        worker.once("exit", (code) => {
          activeWorkers -= 1;
          if (code !== 0) {
            reject(new Error(`Balance lab worker exited with code ${code}.`));
            return;
          }

          pump();
        });
      }
    };

    pump();
  });
}

function ensureBaselineCandidate(
  candidates: BalanceCandidateDefinition[],
  baseline: BalanceCandidateDefinition
): BalanceCandidateDefinition[] {
  if (candidates.some((candidate) => candidate.id === baseline.id)) {
    return candidates;
  }

  return [baseline, ...candidates];
}

function requireCandidate(
  candidates: BalanceCandidateDefinition[],
  id: string
): BalanceCandidateDefinition {
  const candidate = candidates.find((entry) => entry.id === id);
  if (!candidate) {
    throw new Error(`Balance lab is missing the ${id} candidate.`);
  }

  return candidate;
}

function requireEvaluation(
  evaluations: BalanceLabEvaluation[],
  id: string
): BalanceLabEvaluation {
  const evaluation = evaluations.find((entry) => entry.candidate.id === id);
  if (!evaluation) {
    throw new Error(`Balance lab is missing the ${id} evaluation.`);
  }

  return evaluation;
}

function resolveWorkerCount(requested: number): number {
  if (requested > 0) {
    return requested;
  }

  return Math.max(1, Math.min(cpus().length, 6));
}

function buildRecommendation(
  best: BalanceLabEvaluation,
  baseline: BalanceLabEvaluation
): BalanceLabReport["recommendation"] {
  const improvement =
    baseline.objective.total <= 0
      ? 0
      : ((baseline.objective.total - best.objective.total) / baseline.objective.total) * 100;
  const roundedImprovement = Math.round(improvement * 100) / 100;
  const isDifferentCandidate = best.candidate.id !== baseline.candidate.id;
  const shouldApply = isDifferentCandidate && roundedImprovement >= 3;

  return {
    shouldApply,
    improvementVsBaselinePercent: roundedImprovement,
    candidateId: best.candidate.id,
    override: best.candidate.override,
    reason: shouldApply
      ? `Best candidate beats baseline by ${roundedImprovement.toFixed(
          2
        )}% on the current objective, so it is strong enough to review for live adoption.`
      : isDifferentCandidate
        ? `Best candidate only improves baseline by ${roundedImprovement.toFixed(
            2
          )}%, so keep the current defaults until real-save QA confirms the gain.`
        : "Baseline is still the best candidate in the current search space.",
  };
}

function readIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
