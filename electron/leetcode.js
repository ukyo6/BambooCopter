const STUDY_PLAN = 'https://leetcode.cn/studyplan/top-100-liked/';
const GRAPHQL = 'https://leetcode.cn/graphql';

async function graphql(query, variables, referer) {
  const response = await fetch(GRAPHQL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0',
      referer,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`力扣请求失败: ${response.status}`);
  }
  const payload = await response.json();
  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors[0].message);
  }
  return payload.data;
}

async function fetchPlan() {
  const data = await graphql(
    `query {
      studyPlanV2Detail(planSlug: "top-100-liked") {
        name
        planSubGroups {
          name
          questions { title titleSlug translatedTitle difficulty }
        }
      }
    }`,
    undefined,
    STUDY_PLAN,
  );
  const detail = data.studyPlanV2Detail;
  if (!detail) throw new Error('没有拿到热题 100 题单');
  const problems = [];
  let sortIndex = 0;
  for (const group of detail.planSubGroups || []) {
    for (const question of group.questions || []) {
      problems.push({
        slug: question.titleSlug,
        title: question.title,
        translatedTitle: question.translatedTitle || '',
        difficulty: question.difficulty,
        groupName: group.name,
        sortIndex,
      });
      sortIndex += 1;
    }
  }
  return { name: detail.name, problems };
}

async function fetchQuestion(slug) {
  const data = await graphql(
    `query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        translatedTitle
        translatedContent
        codeSnippets { langSlug code }
      }
    }`,
    { titleSlug: slug },
    `https://leetcode.cn/problems/${slug}/`,
  );
  const question = data.question;
  if (!question) throw new Error('没有拿到题目内容');
  const java = (question.codeSnippets || []).find((item) => item.langSlug === 'java');
  return {
    translatedTitle: question.translatedTitle || '',
    contentHtml: question.translatedContent || '',
    javaTemplate: java ? java.code : defaultJavaTemplate(),
  };
}

function defaultJavaTemplate() {
  return `class Solution {\n    \n}\n`;
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { fetchPlan, fetchQuestion, htmlToText, defaultJavaTemplate, STUDY_PLAN };
