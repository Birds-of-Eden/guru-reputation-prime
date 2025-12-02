"use client";

import React from "react";

type AssignTaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  templateId: string | null;
};

// Lightweight placeholder to satisfy imports. Replace with real modal implementation if needed.
export function AssignTaskModal({ isOpen, onClose }: AssignTaskModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-md p-4 shadow-lg max-w-sm w-full space-y-3">
        <p className="text-sm text-slate-700">
          Assign task modal placeholder. Please implement the full modal.
        </p>
        <button
          type="button"
          className="px-3 py-2 text-sm rounded bg-slate-900 text-white"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
