const DINGTALK_API = "https://oapi.dingtalk.com";
const DINGTALK_API_V2 = "https://api.dingtalk.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

export function isDingtalkConfigured(): boolean {
  return !!(process.env.DINGTALK_APP_KEY && process.env.DINGTALK_APP_SECRET);
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const appKey = process.env.DINGTALK_APP_KEY;
  const appSecret = process.env.DINGTALK_APP_SECRET;
  if (!appKey || !appSecret) {
    throw new Error("钉钉应用未配置 AppKey/AppSecret");
  }

  const res = await fetch(`${DINGTALK_API}/gettoken?appkey=${appKey}&appsecret=${appSecret}`);
  const data = await res.json() as any;
  if (data.errcode !== 0) {
    throw new Error(`获取钉钉 access_token 失败: ${data.errmsg}`);
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };
  return cachedToken.token;
}

export interface DingtalkUserInfo {
  userid: string;
  name: string;
  avatar?: string;
  dept_id_list?: number[];
}

export async function getUserInfoByAuthCode(authCode: string): Promise<DingtalkUserInfo> {
  const token = await getAccessToken();

  const userIdRes = await fetch(`${DINGTALK_API}/topapi/v2/user/getuserinfo?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: authCode }),
  });
  const userIdData = await userIdRes.json() as any;

  if (userIdData.errcode === 0 && userIdData.result?.userid) {
    const userid = userIdData.result.userid;
    const detailRes = await fetch(`${DINGTALK_API}/topapi/v2/user/get?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userid, language: "zh_CN" }),
    });
    const detailData = await detailRes.json() as any;
    if (detailData.errcode !== 0) {
      throw new Error(`获取钉钉用户详情失败: ${detailData.errmsg}`);
    }
    return {
      userid: detailData.result.userid,
      name: detailData.result.name,
      avatar: detailData.result.avatar,
      dept_id_list: detailData.result.dept_id_list || [],
    };
  }

  try {
    const userToken = await getUserAccessToken(authCode);
    const res = await fetch(`${DINGTALK_API_V2}/v1.0/contact/users/me`, {
      method: "GET",
      headers: {
        "x-acs-dingtalk-access-token": userToken,
        "Content-Type": "application/json",
      },
    });
    if (res.ok) {
      const userData = await res.json() as any;
      const unionId = userData.unionId;
      if (unionId) {
        const uidRes = await fetch(`${DINGTALK_API}/topapi/user/getbyunionid?access_token=${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unionid: unionId }),
        });
        const uidData = await uidRes.json() as any;
        if (uidData.errcode === 0 && uidData.result?.userid) {
          const detailRes2 = await fetch(`${DINGTALK_API}/topapi/v2/user/get?access_token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userid: uidData.result.userid, language: "zh_CN" }),
          });
          const detailData2 = await detailRes2.json() as any;
          return {
            userid: uidData.result.userid,
            name: userData.nick || userData.name,
            avatar: userData.avatarUrl,
            dept_id_list: detailData2.errcode === 0 ? (detailData2.result?.dept_id_list || []) : [],
          };
        }
      }
    }
  } catch {}

  throw new Error("获取钉钉用户信息失败，请重试");
}

export async function getDepartmentDetail(deptId: number): Promise<{ dept_id: number; name: string; parent_id: number } | null> {
  try {
    const token = await getAccessToken();
    const res = await fetch(`${DINGTALK_API}/topapi/v2/department/get?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dept_id: deptId, language: "zh_CN" }),
    });
    const data = await res.json() as any;
    if (data.errcode !== 0) {
      console.error(`获取钉钉部门详情失败: ${data.errmsg}`);
      return null;
    }
    return {
      dept_id: data.result.dept_id,
      name: data.result.name,
      parent_id: data.result.parent_id,
    };
  } catch (err) {
    console.error("获取钉钉部门详情异常:", err);
    return null;
  }
}

export async function getParentDepartmentName(deptId: number): Promise<string | null> {
  console.log(`[DT Dept] getParentDepartmentName called with deptId=${deptId}`);
  if (deptId === 1) return null;

  const dept = await getDepartmentDetail(deptId);
  if (!dept) return null;
  console.log(`[DT Dept] deptId=${deptId}, name="${dept.name}", parent_id=${dept.parent_id}`);

  if (!dept.parent_id || dept.parent_id <= 0) return null;

  if (dept.parent_id === 1) {
    console.log(`[DT Dept] -> parent_id is 1, returning "${dept.name}"`);
    return dept.name;
  }

  const parentDept = await getDepartmentDetail(dept.parent_id);
  if (!parentDept) return null;
  console.log(`[DT Dept] parent: name="${parentDept.name}", parent_id=${parentDept.parent_id}`);

  if (parentDept.parent_id === 1) {
    console.log(`[DT Dept] -> parent's parent_id is 1, returning "${parentDept.name}"`);
    return parentDept.name;
  }

  let current = parentDept;
  for (let i = 0; i < 10; i++) {
    const upper = await getDepartmentDetail(current.parent_id);
    if (!upper) return current.name;
    console.log(`[DT Dept] traversing: name="${upper.name}", parent_id=${upper.parent_id}`);
    if (upper.parent_id === 1) return upper.name;
    current = upper;
  }

  return current.name;
}

async function getUserAccessToken(authCode: string): Promise<string> {
  const appKey = process.env.DINGTALK_APP_KEY;
  const appSecret = process.env.DINGTALK_APP_SECRET;

  const res = await fetch(`${DINGTALK_API_V2}/v1.0/oauth2/userAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: appKey,
      clientSecret: appSecret,
      code: authCode,
      grantType: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error("获取钉钉用户 token 失败");
  }

  const data = await res.json() as any;
  return data.accessToken;
}

export interface DingtalkDepartment {
  dept_id: number;
  name: string;
  parent_id: number;
}

export interface DingtalkUser {
  userid: string;
  name: string;
  dept_id_list: number[];
  title?: string;
  avatar?: string;
}

export async function getDepartmentList(): Promise<DingtalkDepartment[]> {
  const token = await getAccessToken();
  const allDepts: DingtalkDepartment[] = [];

  const fetchSubDepts = async (deptId: number) => {
    const res = await fetch(`${DINGTALK_API}/topapi/v2/department/listsub?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dept_id: deptId, language: "zh_CN" }),
    });
    const data = await res.json() as any;
    if (data.errcode !== 0) {
      console.error(`获取钉钉部门列表失败: ${data.errmsg}`);
      return;
    }
    for (const dept of (data.result || [])) {
      allDepts.push({
        dept_id: dept.dept_id,
        name: dept.name,
        parent_id: dept.parent_id,
      });
      await fetchSubDepts(dept.dept_id);
    }
  };

  await fetchSubDepts(1);
  return allDepts;
}

export async function getDepartmentUsers(deptId: number): Promise<DingtalkUser[]> {
  const token = await getAccessToken();
  const allUsers: DingtalkUser[] = [];
  let cursor = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(`${DINGTALK_API}/topapi/v2/user/list?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dept_id: deptId,
        cursor,
        size: 100,
        language: "zh_CN",
      }),
    });
    const data = await res.json() as any;
    if (data.errcode !== 0) {
      console.error(`获取部门用户失败: ${data.errmsg}`);
      break;
    }
    const list = data.result?.list || [];
    for (const u of list) {
      allUsers.push({
        userid: u.userid,
        name: u.name,
        dept_id_list: u.dept_id_list || [],
        title: u.title,
        avatar: u.avatar,
      });
    }
    hasMore = data.result?.has_more || false;
    cursor = data.result?.next_cursor || 0;
  }

  return allUsers;
}

export async function getAllDingtalkUsers(): Promise<DingtalkUser[]> {
  const depts = await getDepartmentList();
  const allUsers = new Map<string, DingtalkUser>();

  for (const dept of depts) {
    const users = await getDepartmentUsers(dept.dept_id);
    for (const u of users) {
      if (!allUsers.has(u.userid)) {
        allUsers.set(u.userid, u);
      }
    }
  }

  return Array.from(allUsers.values());
}

export function getDingtalkCorpId(): string {
  return process.env.DINGTALK_CORP_ID || "";
}

export function getDingtalkAppKey(): string {
  return process.env.DINGTALK_APP_KEY || "";
}
