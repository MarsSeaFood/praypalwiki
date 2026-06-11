import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const cardFile = "cards.csv";
const outputFile = "changelog.json";
const fields = ["cardname_cn", "cardname_en", "cardeffect_cn", "cardeffect_en"];

const commits = getCommits(cardFile);
const entries = commits.map((commit) => {
  const currentCards = readCardsAt(`${commit.hash}:${cardFile}`);
  const previousCards = commit.parent ? readCardsAt(`${commit.parent}:${cardFile}`) : [];

  return {
    id: commit.hash,
    time: commit.time,
    action: commit.subject || "更新卡牌数据",
    source: cardFile,
    commitUrl: getCommitUrl(commit.hash),
    changes: compareCards(previousCards, currentCards),
  };
});

writeFileSync(outputFile, `${JSON.stringify(entries, null, 2)}\n`, "utf8");

function getCommits(file) {
  const output = git(["log", "--follow", "--format=%H%x09%cI%x09%s", "--", file]);
  if (!output.trim()) {
    return [];
  }

  return output
    .trim()
    .split("\n")
    .map((line) => {
      const [hash, time, ...subjectParts] = line.split("\t");
      return {
        hash,
        time,
        subject: subjectParts.join("\t"),
        parent: getFirstParent(hash),
      };
    });
}

function getFirstParent(hash) {
  const line = git(["rev-list", "--parents", "-n", "1", hash]).trim();
  return line.split(" ")[1] || "";
}

function readCardsAt(spec) {
  try {
    return normalizeCards(parseCsv(git(["show", spec])));
  } catch (error) {
    return [];
  }
}

function compareCards(previousCards, nextCards) {
  const previousMap = new Map(previousCards.map((card) => [card.id, card]));
  const nextMap = new Map(nextCards.map((card) => [card.id, card]));
  const added = [];
  const removed = [];
  const updated = [];
  let unchanged = 0;

  nextMap.forEach((nextCard, id) => {
    const previousCard = previousMap.get(id);
    if (!previousCard) {
      added.push(nextCard);
      return;
    }

    const changedFields = fields.filter((field) => previousCard[field] !== nextCard[field]);
    if (changedFields.length) {
      updated.push({ before: previousCard, after: nextCard, fields: changedFields });
    } else {
      unchanged += 1;
    }
  });

  previousMap.forEach((previousCard, id) => {
    if (!nextMap.has(id)) {
      removed.push(previousCard);
    }
  });

  return {
    summary: {
      added: added.length,
      removed: removed.length,
      updated: updated.length,
      unchanged,
    },
    added,
    removed,
    updated,
  };
}

function parseCsv(text) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const records = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if (char === "\n" && !inQuotes) {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    records.push(row);
  }

  const [header, ...body] = records.filter((record) => record.some((value) => value.trim()));
  if (!header) {
    return [];
  }

  const keys = header.map((key) => key.trim());
  return body.map((record) => {
    const item = {};
    keys.forEach((key, index) => {
      item[key] = (record[index] || "").trim();
    });
    return item;
  });
}

function normalizeCards(rows) {
  return rows
    .map((card) => ({
      id: String(card.id || "").trim(),
      cardname_cn: String(card.cardname_cn || "").trim(),
      cardname_en: String(card.cardname_en || "").trim(),
      cardeffect_cn: String(card.cardeffect_cn || "").trim(),
      cardeffect_en: String(card.cardeffect_en || "").trim(),
    }))
    .filter((card) => card.id);
}

function getCommitUrl(hash) {
  const repo = process.env.GITHUB_REPOSITORY;
  const server = process.env.GITHUB_SERVER_URL || "https://github.com";
  return repo ? `${server}/${repo}/commit/${hash}` : "";
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}
