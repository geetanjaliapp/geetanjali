import { useState, useCallback, useEffect, useRef } from "react";
import { casesApi, outputsApi } from "../lib/api";
import { messagesApi } from "../api/messages";
import type { Case, Message, Output } from "../types";
import { errorMessages } from "../lib/errorMessages";

// Exponential backoff constants
const POLL_INITIAL_INTERVAL = 1000; // Start at 1s for fast initial feedback
const POLL_MAX_INTERVAL = 5000; // Cap at 5s per user alignment

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
  // Starts at 1s for fast feedback, doubles each poll, caps at 5s
  const pollIntervalRef = useRef(POLL_INITIAL_INTERVAL);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isProcessing || !caseId) {
      // Reset interval when not processing
      pollIntervalRef.current = POLL_INITIAL_INTERVAL;
      return;
    }

    const poll = async () => {
      try {
        const data = await casesApi.get(caseId);
        setCaseData(data);

        if (
          data.status === "completed" ||
          data.status === "failed" ||
          data.status === "policy_violation"
        ) {
          // Reset interval for next time
          pollIntervalRef.current = POLL_INITIAL_INTERVAL;
          loadCaseData();
          return; // Stop polling
        }
      } catch {
        // Silent fail - polling will retry with backoff
      }

      // Schedule next poll with exponential backoff
      pollIntervalRef.current = Math.min(
        pollIntervalRef.current * 2,
        POLL_MAX_INTERVAL,
      );
      pollTimeoutRef.current = setTimeout(poll, pollIntervalRef.current);
    };

    // Start first poll after initial interval
    pollTimeoutRef.current = setTimeout(poll, pollIntervalRef.current);

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
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
