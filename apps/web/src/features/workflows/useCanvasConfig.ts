import { create } from "zustand";
import type { RunTrace } from "../../types/domain";

type CanvasConfigState = {
  selectedAgentId: string;
  selectedWorkflowId: string;
  selectedNodeId: string;
  modelProviderId: string;
  knowledgeBaseIds: string[];
  userInput: string;
  userFileInput: string;
  latestRun: RunTrace | null;
  configureAgentWorkflow: (agentId: string, workflowId: string) => void;
  setSelectedNodeId: (selectedNodeId: string) => void;
  setModelProviderId: (modelProviderId: string) => void;
  toggleKnowledgeBaseId: (knowledgeBaseId: string) => void;
  setUserInput: (userInput: string) => void;
  setUserFileInput: (userFileInput: string) => void;
  setLatestRun: (latestRun: RunTrace | null) => void;
};

export const useCanvasConfig = create<CanvasConfigState>((set) => ({
  selectedAgentId: "",
  selectedWorkflowId: "",
  selectedNodeId: "",
  modelProviderId: "",
  knowledgeBaseIds: [],
  userInput: "Order ORD-2048 asks whether refund is allowed",
  userFileInput: "",
  latestRun: null,
  configureAgentWorkflow: (selectedAgentId, selectedWorkflowId) => set({ selectedAgentId, selectedWorkflowId, selectedNodeId: "", latestRun: null }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
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
  setUserFileInput: (userFileInput) => set({ userFileInput }),
  setLatestRun: (latestRun) => set({ latestRun })
}));
