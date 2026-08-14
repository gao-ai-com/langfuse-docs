const { CATEGORIES, TERMS } = require("./glossary-data.js");

function replaceComponentsWithMarkdown(fileContent) {
  const exportedResourceArrays = extractExportedResourceArrays(fileContent);
  return stripResourceArrayExports(
    fileContent,
    Object.keys(exportedResourceArrays),
  )
    .replace(
      /<(ManualGuideCallout(?:Ja)?)\b([\s\S]*?)\/>/g,
      (_, componentName, attributes) =>
        `\n${renderManualGuideCallout(
          attributes,
          componentName === "ManualGuideCalloutJa",
        )}\n`,
    )
    .replace(
      /<ManualGuideList\b([\s\S]*?)\/>/g,
      (_, attributes) => `\n${renderManualGuideList(attributes)}\n`,
    )
    .replace(
      /<ProductUpdateSignup\b([\s\S]*?)\/>/g,
      (_, attributes) => `\n${renderProductUpdateSignup(attributes)}\n`,
    )
    .replace(/<Glossary\s*\/>/g, () => `\n${renderGlossary()}\n`)
    .replace(
      /<JudgePromptExampleJa\s*\/>/g,
      () => `\n${renderJudgePromptExampleJa()}\n`,
    )
    .replace(
      /<JudgePromptExample\s*\/>/g,
      () => `\n${renderJudgePromptExample()}\n`,
    )
    .replace(
      /<FurtherReading\b([\s\S]*?)\/>/g,
      (_, attributes) =>
        `\n${renderFurtherReading(attributes, exportedResourceArrays)}\n`,
    )
    .replace(/<Ref\b([\s\S]*?)\/>/g, (_, attributes) =>
      renderRef(attributes, exportedResourceArrays),
    );
}

/**
 * Splits content on fenced code blocks; even indices are outside fences.
 * Keeps export handling away from code samples that merely show
 * `export const … = […]` (see PR #3436 review).
 */
function splitOnCodeFences(content) {
  return content.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/);
}

function extractExportedResourceArrays(fileContent) {
  const arrays = {};
  for (const [index, segment] of splitOnCodeFences(fileContent).entries()) {
    if (index % 2 !== 0) continue;
    for (const match of segment.matchAll(
      /export const (\w+) = (\[[\s\S]*?\]);/g,
    )) {
      const resources = tryParseResourceArray(match[2]);
      if (resources && resources.length > 0) {
        arrays[match[1]] = resources;
      }
    }
  }
  return arrays;
}

function stripResourceArrayExports(fileContent, arrayNames) {
  if (arrayNames.length === 0) {
    return fileContent;
  }
  const pattern = new RegExp(
    `export const (?:${arrayNames.join("|")}) = \\[[\\s\\S]*?\\];\\n*`,
    "g",
  );
  return splitOnCodeFences(fileContent)
    .map((segment, index) =>
      index % 2 === 0 ? segment.replace(pattern, "") : segment,
    )
    .join("");
}

function tryParseResourceArray(arraySource) {
  try {
    return parseResourceArray(arraySource);
  } catch {
    return null;
  }
}

function parseResourceArray(arraySource) {
  return [...arraySource.matchAll(/\{([\s\S]*?)\}/g)].map(
    ([, resourceSource]) => {
      const title = extractObjectString(resourceSource, "title");
      const url = extractObjectString(resourceSource, "url");

      if (!title || !url) {
        throw new Error("Resource entries require string title and url values");
      }

      return {
        id: extractObjectString(resourceSource, "id"),
        title,
        url,
      };
    },
  );
}

function renderRef(attributes, exportedResourceArrays) {
  const id = extractAttributeString(attributes, "id");
  const refsMatch = attributes.match(/\brefs=\{(\w+)\}/);
  const refs = refsMatch ? exportedResourceArrays[refsMatch[1]] : undefined;

  if (!id || !refs) {
    throw new Error(
      "Ref requires an id and a refs identifier exported from the page",
    );
  }

  const index = refs.findIndex((resource) => resource.id === id);
  if (index === -1) {
    throw new Error(`Ref id "${id}" is not present in its refs array`);
  }

  return `[${index + 1}]`;
}

function renderFurtherReading(attributes, exportedResourceArrays) {
  let resources;
  const literalMatch = attributes.match(/\bresources=\{(\[[\s\S]*?\])\}/);
  if (literalMatch) {
    resources = parseResourceArray(literalMatch[1]);
  } else {
    const identifierMatch = attributes.match(/\bresources=\{(\w+)\}/);
    resources = identifierMatch
      ? exportedResourceArrays[identifierMatch[1]]
      : undefined;
  }

  if (!resources) {
    throw new Error("FurtherReading is missing a resources array");
  }

  if (resources.length === 0) {
    throw new Error("FurtherReading resources array is empty");
  }

  const numbered = /(?:^|\s)numbered(?:\s|=|$)/.test(attributes);
  if (numbered) {
    return resources
      .map(
        (resource, index) =>
          `${index + 1}. [${resource.title}](${resource.url})`,
      )
      .join("\n");
  }

  const lines = ["Further reading:"];
  for (const resource of resources) {
    lines.push(`- [${resource.title}](${resource.url})`);
  }
  return lines.join("\n");
}

function renderJudgePromptExample() {
  return [
    "```text",
    "# 1. Context",
    "You evaluate replies from an apartment-leasing assistant. The assistant",
    "answers using the property information provided in its context. It has",
    "no availability calendar and cannot schedule tours itself.",
    "",
    "# 2. One precise criterion, including what to ignore",
    "Criterion: the reply must only state facts present in the provided",
    "context. A reply that invents specifics (times, prices, availability)",
    "fails, even if it sounds helpful. Ignore style and formatting.",
    "",
    "# 3. Labeled examples with their reasons",
    "Example (fail):",
    'User: "Do you have a 2-bed available for July 1?"',
    'Reply: "Yes! I have a 2-bed ready for you, tour at 2pm works."',
    'Reasoning: the context contains no tour time. "2pm" is invented.',
    "Verdict: fail",
    "",
    "Example (pass):",
    'User: "What\'s the pet policy?"',
    'Reply: "Cats and dogs under 40 lbs are welcome with a $300 deposit."',
    "Reasoning: every fact (cats and dogs, 40 lbs, $300) is in the context.",
    "Verdict: pass",
    "",
    "# 4. Reasoning first, verdict last",
    "Evaluate the reply below. Write your reasoning first, then output exactly",
    "# 5. A way out",
    "one of: pass, fail, unknown.",
    "```",
  ].join("\n");
}

function renderJudgePromptExampleJa() {
  return [
    "```text",
    "# 1. コンテキスト",
    "あなたは賃貸物件アシスタントの返答を評価します。このアシスタントは、",
    "コンテキストとして渡された物件情報をもとに回答します。空室状況の",
    "カレンダーは持たず、内見の予約を自分で入れることもできません。",
    "",
    "# 2. 明確な基準を1つだけ（無視するものも明示する）",
    "基準: 返答は、渡されたコンテキストにある事実だけを述べること。具体的な",
    "情報 (時刻、価格、空室状況) を作り出している返答は、たとえ親切に見えても",
    "不合格とする。文体や書式は評価しない。",
    "",
    "# 3. 理由付きのラベル付きの例",
    "例 (不合格):",
    "ユーザー: 「7月1日から入居できる2ベッドルームはありますか?」",
    "返答: 「はい、2ベッドルームをご用意できます。内見は14時でいかがでしょうか。」",
    "理由: コンテキストに内見の時刻は含まれていない。「14時」は作り出された情報。",
    "判定: fail",
    "",
    "例 (合格):",
    "ユーザー: 「ペットの規約はどうなっていますか?」",
    "返答: 「40 lbs 以下の犬猫は、デポジット $300 でご入居いただけます。」",
    "理由: 述べられている事実 (犬猫、40 lbs、$300) はすべてコンテキストにある。",
    "判定: pass",
    "",
    "# 4. 理由が先、判定が後",
    "以下の返答を評価してください。まず理由を書き、最後に次のいずれか 1 つだけを",
    "出力してください:",
    "# 5. 逃げ道を用意",
    "pass、fail、unknown。",
    "```",
  ].join("\n");
}

// The email sign-up form has no Markdown equivalent, so point Markdown/PDF
// readers to the page where they can subscribe.
function renderProductUpdateSignup(attributes) {
  const list = extractAttributeString(attributes, "list");
  return list === "oss"
    ? "Subscribe to the Langfuse OSS newsletter at https://langfuse.com/self-hosting/oss-newsletter."
    : "Subscribe to the Langfuse product update newsletter at https://langfuse.com/changelog.";
}

function renderManualGuideCallout(attributes, isJapanese) {
  const href = extractAttributeString(attributes, "href");
  const topic = extractAttributeString(attributes, "topic");
  const lede = extractAttributeString(attributes, "lede");

  if (!href || !topic) {
    throw new Error("ManualGuideCallout requires string href and topic values");
  }

  const label = isJapanese ? "ガイド" : "Guide";
  const lines = [`> **${label}: [${topic}](${href})**`];
  if (lede) {
    lines.push(">", `> ${lede}`);
  }
  return lines.join("\n");
}

function renderManualGuideList(attributes) {
  const title = extractAttributeString(attributes, "title") ?? "Guides";
  const guidesMatch = attributes.match(/\bguides=\{\[([\s\S]*?)\]\}/);
  if (!guidesMatch) {
    throw new Error("ManualGuideList is missing a guides array");
  }

  const guides = [...guidesMatch[1].matchAll(/\{([\s\S]*?)\}/g)].map(
    ([, guideSource]) => {
      const href = extractObjectString(guideSource, "href");
      const topic = extractObjectString(guideSource, "topic");
      const lede = extractObjectString(guideSource, "lede");

      if (!href || !topic) {
        throw new Error(
          "ManualGuideList guides require string href and topic values",
        );
      }

      return { href, topic, lede };
    },
  );

  if (guides.length === 0) {
    throw new Error("ManualGuideList guides array is empty");
  }

  const lines = [`## ${title}`, ""];
  for (const guide of guides) {
    lines.push(
      `- [${guide.topic}](${guide.href})${guide.lede ? ` — ${guide.lede}` : ""}`,
    );
  }
  return lines.join("\n");
}

function extractObjectString(source, property) {
  return extractQuotedValue(
    source,
    new RegExp(`\\b${property}:\\s*"((?:\\\\.|[^"\\\\])*)"`),
  );
}

function extractAttributeString(source, attribute) {
  return extractQuotedValue(
    source,
    new RegExp(`\\b${attribute}="((?:\\\\.|[^"\\\\])*)"`),
  );
}

function extractQuotedValue(source, pattern) {
  const match = source.match(pattern);
  return match ? JSON.parse(`"${match[1]}"`) : null;
}

function renderGlossary() {
  const sortedTerms = TERMS.toSorted((a, b) => a.term.localeCompare(b.term));
  let currentLetter = "";
  const lines = [];

  for (const term of sortedTerms) {
    const letter = term.term[0].toUpperCase();
    if (letter !== currentLetter) {
      currentLetter = letter;
      lines.push(`## ${letter}`, "");
    }

    lines.push(`### ${term.term} [#${term.id}]`, "");
    if (term.synonyms?.length) {
      lines.push(`Also known as: ${term.synonyms.join(", ")}`, "");
    }
    lines.push(term.definition, "");
    if (term.categories?.length) {
      lines.push(
        `Categories: ${term.categories
          .map((category) => CATEGORIES[category]?.label ?? category)
          .join(", ")}`,
        "",
      );
    }
    if (term.relatedTerms?.length) {
      lines.push(`Related: ${term.relatedTerms.join(", ")}`, "");
    }
    if (term.link) {
      lines.push(`[Learn more](${term.link})`, "");
    }
  }

  return lines.join("\n");
}

module.exports = {
  replaceComponentsWithMarkdown,
};
