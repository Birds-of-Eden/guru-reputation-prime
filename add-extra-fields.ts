// add-extra-fields.ts
// Usage: npx ts-node add-extra-fields.ts prisma/schema.prisma
// Or add to package.json scripts: "add-extra-fields": "ts-node add-extra-fields.ts prisma/schema.prisma"

import * as fs from "fs";
import * as path from "path";

const file = process.argv[2] || "prisma/schema.prisma";

if (!fs.existsSync(file)) {
  console.error(`❌ File not found: ${file}`);
  process.exit(1);
}

const src = fs.readFileSync(file, "utf8");

// Safe regex (no 's' flag): capture each model block
const modelBlockRegex = /model\s+([A-Za-z0-9_]+)\s*\{[\s\S]*?\}/gm;

function hasField(block: string, fieldName: string): boolean {
  const fieldRegex = new RegExp(`\\n\\s*${fieldName}\\s+`, "i");
  return fieldRegex.test(block);
}

function typeForIndex(i: number): "String?" | "Int?" | "Boolean?" | "Json?" {
  if (i < 2) return "String?";
  if (i < 4) return "Int?";
  if (i === 4) return "Boolean?";
  return "Json?"; // remaining 5
}

function injectFieldsIntoModel(block: string, modelName: string): { block: string; added: string[] } {
  const lc = modelName.toLowerCase();
  const names = Array.from({ length: 10 }, (_, i) => `${lc}_field_${String(i + 1).padStart(2, "0")}`);

  const linesToAdd: string[] = [];
  const addedNames: string[] = [];

  for (let i = 0; i < names.length; i++) {
    const fname = names[i];
    if (!hasField(block, fname)) {
      const fieldType = typeForIndex(i);
      linesToAdd.push(`  ${fname} ${fieldType} // auto-added`);
      addedNames.push(`${fname}:${fieldType}`);
    }
  }

  if (linesToAdd.length === 0) return { block, added: [] };

  const newBlock = block.replace(/\}\s*$/, `\n${linesToAdd.join("\n")}\n}`);
  return { block: newBlock, added: addedNames };
}

const additionsLog: string[] = [];
const out = src.replace(modelBlockRegex, (block, modelName) => {
  const { block: updated, added } = injectFieldsIntoModel(block, modelName);
  if (added.length) {
    additionsLog.push(`• ${modelName}: ${added.join(", ")}`);
  }
  return updated;
});

fs.writeFileSync(file, out, "utf8");

console.log(`✅ Ensured 10 mixed-type fields on every model in ${path.basename(file)}\n`);
if (additionsLog.length) {
  console.log("Added fields:");
  for (const line of additionsLog) console.log(line);
} else {
  console.log("No new fields were added (all already present).");
}
