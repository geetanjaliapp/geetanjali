import { useState, useCallback, useEffect } from "react";
import { casesApi, outputsApi } from "../lib/api";
import { messagesApi } from "../api/messages";
import type { Case, Message, Output } from "../types";
import { errorMessages } from "../lib/errorMessages";

interface UseCaseDataOptions {
  caseId: string | undefined;
  isAuthenticated: boolean;
}

/**
 * Manages case data loading and polling
 * Extracts data-fetching concerns from CaseView component
 */
export function useCaseData({ caseId, isAuthenticated }: UseCaseDataOptions) {
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [wasProcessing, setWasProcessing] = useState(false);
  const [showCompletionBanner, setShowCompletionBanner] = useState(false);

  const isProcessing =
    caseData?.status === "pending" || caseData?.status === "processing";
  const isFailed = caseData?.status === "failed";
  const isPolicyViolation = caseData?.status === "policy_violation";
  const isCompleted =
    caseData?.status === "completed" ||
    caseData?.status === "policy_violation" ||
    !caseData?.status;

  const loadCaseData = useCallback(async () => {
    if (!caseId) return;

    try {
      const data = await casesApi.get(caseId);
      setCaseData(data);

      if (
        data.status === "completed" ||
        data.status === "failed" ||
        data.status === "policy_violation" ||
        !data.status
      ) {
        const messagesData = await messagesApi.list(caseId);
        setMessages(messagesData);

        const outputsData = await outputsApi.listByCaseId(caseId);
        setOutputs(outputsData);

        if (!isAuthenticated && outputsData.length > 0) {
          setShowSignupPrompt(true);
        }
      }
    } catch (err) {
      setError(errorMessages.caseLoad(err));
    } finally {
      setLoading(false);
    }
  }, [caseId, isAuthenticated]);

  useEffect(() => {
    loadCaseData();
  }, [loadCaseData]);

  // Track when case transitions from processing to completed
  useEffect(() => {
    if (isProcessing) {
      setWasProcessing(true);
    }
  }, [isProcessing]);

  // Show completion banner when analysis finishes
  useEffect(() => {
    if (wasProcessing && isCompleted && outputs.length > 0) {
      setShowCompletionBanner(true);
      setWasProcessing(false);
      const timer = setTimeout(() => setShowCompletionBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [wasProcessing, isCompleted, outputs.length]);

  // Polling for processing status with exponential backoff
  // LLM operations take 1-3 minutes, so aggressive polling is wasteful
  useEffect(() => {
    if (!isProcessing || !caseId) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let interval = 2000; // Start at 2 seconds
    const maxInterval = 10000; // Cap at 10 seconds
    const backoffFactor = 1.5;

    const poll = async () => {
      try {
        const data = await casesApi.get(caseId);
        setCaseData(data);

        if (
          data.status === "completed" ||
          data.status === "failed" ||
          data.status === "policy_violation"
        ) {
          loadCaseData();
          return; // Stop polling
        }

        // Increase interval with exponential backoff (capped)
        interval = Math.min(interval * backoffFactor, maxInterval);
        timeoutId = setTimeout(poll, interval);
      } catch {
        // On error, retry with same interval
        timeoutId = setTimeout(poll, interval);
      }
    };

    timeoutId = setTimeout(poll, interval);
    return () => clearTimeout(timeoutId);
  }, [isProcessing, caseId, loadCaseData]);

  return {
    caseData,
    messages,
    outputs,
    loading,
    error,
    showSignupPrompt,
    showCompletionBanner,
    isProcessing,
    isFailed,
    isPolicyViolation,
    isCompleted,
    setShowSignupPrompt,
    setShowCompletionBanner,
    setMessages,
    setOutputs,
    setError,
    setCaseData,
    loadCaseData,
  };
}

export default useCaseData;
