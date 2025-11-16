"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function TrackDevelopment() {
  const [preview, setPreview] = useState<string | null>(null);

  const baseline = [
    "/images/glenn-allyn-baseline-1.png",
    "/images/glenn-allyn-baseline-2.png",
  ];

  const previous = [
    "/images/glenn-allyn-previous-1-october.png",
    "/images/glenn-allyn-previous-2-october.png",
  ];

  const current = [
    "/images/glenn-allyn-current-1-november.png",
    "/images/glenn-allyn-current-2-november.png",
  ];

  return (
    <div className="min-h-screen p-10 bg-gradient-to-b from-white to-slate-100 dark:from-neutral-900 dark:to-black">
      {/* PAGE HEADER */}
      <div className="text-center mb-20">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-4">
          <span className="text-5xl">🚀</span>
          Track Your Development <span className="text-indigo-500">(Live)</span>
        </h1>

        <p className="mt-3 text-lg text-slate-500 dark:text-slate-400">
          Monitor your monthly transformation visually
        </p>
      </div>

      {/* BASELINE (TOP ALWAYS) */}
      <div className="text-center mb-24">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-8">
          📍 Baseline — Starting Point
        </h2>

        <div className="flex justify-center gap-10">
          {baseline.map((src) => (
            <motion.div
              key={src}
              whileHover={{ scale: 1.03 }}
              className="w-[420px] h-[420px] overflow-hidden rounded-2xl border border-slate-300 dark:border-neutral-700 shadow-xl cursor-pointer"
              onClick={() => setPreview(src)}
            >
              <Image
                src={src}
                alt="Baseline Image"
                width={420}
                height={420}
                className="w-full h-full object-cover"
              />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 text-4xl text-indigo-600 dark:text-indigo-300 animate-bounce"
        >
          ↓
        </motion.div>
      </div>

      {/* MAIN PROGRESS GRID */}
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-16 max-w-7xl mx-auto">
        {/* LEFT — PREVIOUS */}
        <section className="flex flex-col items-center gap-10">
          <h3 className="text-2xl font-semibold text-slate-700 dark:text-slate-200">
            ⏮️ Previous (October)
          </h3>

          {previous.map((src) => (
            <motion.div
              key={src}
              whileHover={{ scale: 1.02 }}
              className="w-[420px] h-[420px] rounded-xl overflow-hidden border border-slate-300 dark:border-neutral-700 shadow-lg cursor-pointer"
              onClick={() => setPreview(src)}
            >
              <Image
                src={src}
                alt="Previous Image"
                width={420}
                height={420}
                className="w-full h-full object-cover"
              />
            </motion.div>
          ))}
        </section>

        {/* CENTER — CLEAN PROGRESS LINE ONLY (NO TEXT, NO ARROW) */}
        <div className="relative flex flex-col items-center">
          {/* Vertical Line */}
          <div className="w-1 h-full bg-gradient-to-b from-indigo-500 via-blue-500 to-emerald-500 rounded-full"></div>

          {/* Top Dot */}
          <div className="absolute top-10 w-5 h-5 bg-white rounded-full shadow-md ring-4 ring-indigo-400"></div>

          {/* Middle Circle */}
          <div className="absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-md ring-[5px] ring-blue-400"></div>

          {/* Bottom Dot */}
          <div className="absolute bottom-10 w-5 h-5 bg-white rounded-full shadow-md ring-4 ring-emerald-400"></div>
        </div>

        {/* RIGHT — CURRENT */}
        <section className="flex flex-col items-center gap-10">
          <h3 className="text-2xl font-semibold text-slate-700 dark:text-slate-200">
            ⏩ Current (November)
          </h3>

          {current.map((src) => (
            <motion.div
              key={src}
              whileHover={{ scale: 1.02 }}
              className="w-[420px] h-[420px] rounded-xl overflow-hidden border border-slate-300 dark:border-neutral-700 shadow-lg cursor-pointer"
              onClick={() => setPreview(src)}
            >
              <Image
                src={src}
                alt="Current Image"
                width={420}
                height={420}
                className="w-full h-full object-cover"
              />
            </motion.div>
          ))}
        </section>
      </div>

      {/* FULL IMAGE PREVIEW MODAL */}
      <AnimatePresence>
        {preview && (
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreview(null)}
          >
            <motion.img
              src={preview}
              className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl"
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.85 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
