import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface OKRDataForAnalysis {
  objectives: any[];
  keyResults: any[];
  departments: any[];
  cycle: string;
  departmentName?: string;
}

export async function generateOKRAnalysis(data: OKRDataForAnalysis): Promise<string> {
  const { objectives, keyResults, departments, cycle, departmentName } = data;

  const totalObj = objectives.length;
  const totalKR = keyResults.length;
  const completedKR = keyResults.filter((kr: any) => kr.status === 'completed').length;
  const behindKR = keyResults.filter((kr: any) => kr.status === 'behind').length;
  const overdueKR = keyResults.filter((kr: any) => kr.status === 'overdue').length;
  const avgProgress = totalKR > 0 ? Math.round(keyResults.reduce((s: number, kr: any) => s + kr.progress, 0) / totalKR) : 0;

  const scoredKR = keyResults.filter((kr: any) => kr.selfScore !== null && kr.selfScore !== undefined);
  const avgScore = scoredKR.length > 0 ? (scoredKR.reduce((s: number, kr: any) => s + kr.selfScore, 0) / scoredKR.length).toFixed(2) : '暂无';

  const deptBreakdown = departments.map((dept: any) => {
    const deptObjs = objectives.filter((o: any) => o.departmentId === dept.id);
    const deptKRs = keyResults.filter((kr: any) => deptObjs.some((o: any) => o.id === kr.objectiveId));
    const deptAvg = deptKRs.length > 0 ? Math.round(deptKRs.reduce((s: number, kr: any) => s + kr.progress, 0) / deptKRs.length) : 0;
    const deptScored = deptKRs.filter((kr: any) => kr.selfScore !== null && kr.selfScore !== undefined);
    const deptAvgScore = deptScored.length > 0 ? (deptScored.reduce((s: number, kr: any) => s + kr.selfScore, 0) / deptScored.length).toFixed(2) : '暂无';
    return {
      name: dept.name,
      objectives: deptObjs.length,
      krs: deptKRs.length,
      avgProgress: deptAvg,
      avgScore: deptAvgScore,
      completed: deptKRs.filter((kr: any) => kr.status === 'completed').length,
      behind: deptKRs.filter((kr: any) => kr.status === 'behind').length,
      overdue: deptKRs.filter((kr: any) => kr.status === 'overdue').length,
    };
  }).filter((d: any) => d.krs > 0);

  const objDetails = objectives.map((obj: any) => {
    const objKRs = keyResults.filter((kr: any) => kr.objectiveId === obj.id);
    return {
      title: obj.title,
      type: obj.okrType || '承诺型',
      department: departments.find((d: any) => d.id === obj.departmentId)?.name || '未知',
      krs: objKRs.map((kr: any) => ({
        title: kr.title,
        progress: kr.progress,
        status: kr.status,
        selfScore: kr.selfScore,
        type: kr.okrType || '承诺型',
      })),
    };
  });

  const scope = departmentName ? `${departmentName}部门` : '全组织';

  const prompt = `你是一位专业的OKR管理顾问。请基于以下${cycle}周期${scope}的OKR数据，撰写一份全面的分析报告。

## 整体数据
- 目标数: ${totalObj}
- 关键结果数: ${totalKR}
- 已完成KR: ${completedKR}
- 进度滞后KR: ${behindKR}
- 已逾期KR: ${overdueKR}
- 平均进度: ${avgProgress}%
- 平均自评分: ${avgScore}

## 各部门数据
${deptBreakdown.map((d: any) => `- ${d.name}: ${d.objectives}个目标, ${d.krs}个KR, 平均进度${d.avgProgress}%, 平均自评${d.avgScore}, 已完成${d.completed}, 滞后${d.behind}, 逾期${d.overdue}`).join('\n')}

## 各目标详情
${objDetails.map((o: any) => `### ${o.title} (${o.type}, ${o.department})
${o.krs.map((kr: any) => `  - ${kr.title}: 进度${kr.progress}%, 状态${kr.status}, 自评${kr.selfScore ?? '未评'}, 类型${kr.type}`).join('\n')}`).join('\n\n')}

请按以下结构输出分析报告（使用Markdown格式）：
1. **总体评估** - 对本周期OKR执行情况的整体评价
2. **亮点与成就** - 做得好的方面
3. **风险与问题** - 需要关注的风险项和问题
4. **部门对比分析** - 各部门的表现对比
5. **改进建议** - 具体的、可执行的改进建议
6. **下周期展望** - 对下个周期的建议和重点方向

请用简洁、专业的中文撰写，突出数据驱动的洞察。`;

  const response = await openai.chat.completions.create({
    model: "DeepSeek-V3.2",
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 4096,
  });

  return response.choices[0]?.message?.content || '分析生成失败，请稍后重试。';
}
