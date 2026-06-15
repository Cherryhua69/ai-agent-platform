import { create } from "zustand";
import type { RunTrace } from "../../types/domain";

type CanvasConfigState = {
  modelProviderId: string;
  knowledgeBaseIds: string[];
  userInput: string;
  latestRun: RunTrace | null;
  setModelProviderId: (modelProviderId: string) => void;
  toggleKnowledgeBaseId: (knowledgeBaseId: string) => void;
  setUserInput: (userInput: string) => void;
  setLatestRun: (latestRun: RunTrace | null) => void;
};

export const useCanvasConfig = create<CanvasConfigState>((set) => ({
  modelProviderId: "",
  knowledgeBaseIds: ["kb-after-sale"],
  userInput: "Order ORD-2048 asks whether refund is allowed",
  latestRun: null,
  setModelProviderId: (modelProviderId) => set({ modelProviderId }),
  toggleKnowledgeBaseId: (knowledgeBaseId) =>
    set((state) => {
      const selected = state.knowledgeBaseIds.includes(knowledgeBaseId);
      return {
        knowledgeBaseIds: selected
          ? state.knowledgeBaseIds.filter((item) => item !== knowledgeBaseId)
          : [...state.knowledgeBaseIds, knowledgeBaseId]
      };
    }),
  setUserInput: (userInput) => set({ userInput }),
  setLatestRun: (latestRun) => set({ latestRun })
}));
