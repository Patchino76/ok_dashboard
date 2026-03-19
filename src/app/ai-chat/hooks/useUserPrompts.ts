import { useState, useEffect, useCallback } from "react";

export interface UserPrompt {
  id: number;
  user: string;
  title: string;
  description: string;
  created_at: string;
}

export interface CreatePromptPayload {
  title: string;
  description: string;
}

const API_BASE = "/api/v1/prompts";

export function useUserPrompts() {
  const [prompts, setPrompts] = useState<UserPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/`);
      if (!res.ok) throw new Error(`Failed to fetch prompts: ${res.status}`);
      const data: UserPrompt[] = await res.json();
      setPrompts(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createPrompt = useCallback(
    async (payload: CreatePromptPayload): Promise<UserPrompt | null> => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Failed to create prompt: ${res.status}`);
        const created: UserPrompt = await res.json();
        setPrompts((prev) => [created, ...prev]);
        return created;
      } catch (e: any) {
        setError(e.message);
        return null;
      }
    },
    [],
  );

  const deletePrompt = useCallback(async (id: number): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204)
        throw new Error(`Failed to delete prompt: ${res.status}`);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  return { prompts, loading, error, fetchPrompts, createPrompt, deletePrompt };
}
