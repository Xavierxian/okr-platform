import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, Platform, ActivityIndicator, ScrollView, Alert, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest, buildUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';
import NotificationBell from '@/components/NotificationBell';

interface SimpleUser {
  id: string;
  displayName: string;
  departmentId: string | null;
  departmentIds?: string[];
  role: string;
}

function getCurrentQuarterCycle(): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const quarterLabel = quarter === 1 ? '一' : quarter === 2 ? '二' : quarter === 3 ? '三' : '四';
  return `${now.getFullYear()} 第${quarterLabel}季度`;
}

export default function OKRsScreen() {
  const insets = useSafeAreaInsets();
  const { objectives, keyResults, departments, isLoading } = useOKR();
  const { user } = useAuth();
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  const [expandedDeptIds, setExpandedDeptIds] = useState<Record<string, boolean>>({});
  const [userSearchKeyword, setUserSearchKeyword] = useState('');
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [sortedObjectives, setSortedObjectives] = useState<typeof objectives>([]);
  const [isExporting, setIsExporting] = useState(false);
  const hasInitializedCycleSelection = useRef(false);

  const userRole = user?.role || 'member';
  const isAdmin = userRole === 'center_head' || userRole === 'vp' || userRole === 'super_admin';
  const isLeadershipRole = userRole === 'center_head' || userRole === 'vp';
  const showUserFilter = true;

  useEffect(() => {
    apiRequest("GET", "/api/users/all-safe")
      .then(res => res.json())
      .then((data: SimpleUser[]) => setAllUsers(data))
      .catch(() => {});
  }, []);

  // 同步 objectives 到 sortedObjectives
  useEffect(() => {
    setSortedObjectives(objectives);
  }, [objectives]);

  // 获取当前用户所在部门ID列表
  const myDeptIds = useMemo(() => {
    return (user as any)?.departmentIds || (user?.departmentId ? [user.departmentId] : []);
  }, [user]);

  // 获取当前用户作为创建人的OKR下的所有执行人
  const myCreatedKRAssigneeIds = useMemo(() => {
    const myCreatedObjIds = new Set(objectives.filter(o => o.createdBy === user?.id).map(o => o.id));
    const assigneeIds = new Set<string>();
    keyResults.forEach(kr => {
      if (kr.objectiveId && myCreatedObjIds.has(kr.objectiveId) && kr.assigneeId) {
        assigneeIds.add(kr.assigneeId);
      }
    });
    return assigneeIds;
  }, [objectives, keyResults, user]);

  const visibleUsers = useMemo(() => {
    let baseUsers = allUsers;

    if (isLeadershipRole) {
      const ownDeptIdSet = new Set(myDeptIds);
      baseUsers = allUsers.filter(u => {
        const uDepts = u.departmentIds || (u.departmentId ? [u.departmentId] : []);
        const isInOwnDepartments = uDepts.some((d: string) => ownDeptIdSet.has(d));
        const isLeadership = u.role === 'center_head' || u.role === 'vp';
        return isInOwnDepartments || isLeadership;
      });
    }
    
    // 普通用户只能看到自己中心的人员，以及自己创建OKR的执行人
    if (userRole === 'member') {
      baseUsers = allUsers.filter(u => {
        const uDepts = u.departmentIds || (u.departmentId ? [u.departmentId] : []);
        const isInMyDept = uDepts.some((d: string) => myDeptIds.includes(d));
        const isMyKRExecutor = myCreatedKRAssigneeIds.has(u.id);
        return isInMyDept || isMyKRExecutor;
      });
    }
    
    // 如果有选中的部门，进一步过滤
    if (selectedDeptIds.length > 0) {
      baseUsers = baseUsers.filter(u => {
        const uDepts = u.departmentIds || (u.departmentId ? [u.departmentId] : []);
        return uDepts.some((d: string) => selectedDeptIds.includes(d));
      });
    }
    
    return baseUsers;
  }, [allUsers, userRole, myDeptIds, selectedDeptIds, myCreatedKRAssigneeIds, isLeadershipRole]);

  const searchedUsers = useMemo(() => {
    const keyword = userSearchKeyword.trim().toLowerCase();
    if (!keyword) return [];
    return visibleUsers.filter(u => u.displayName.toLowerCase().includes(keyword));
  }, [visibleUsers, userSearchKeyword]);

  const isAllCentersScope = isAdmin && selectedDeptIds.length === 0;
  const displayedUsers = useMemo(() => {
    const keyword = userSearchKeyword.trim();
    if (keyword.length > 0) return searchedUsers;
    if (isAllCentersScope) return [];
    return visibleUsers;
  }, [isAllCentersScope, searchedUsers, userSearchKeyword, visibleUsers]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    return visibleUsers.find(u => u.id === selectedUserId) || null;
  }, [visibleUsers, selectedUserId]);

  const filteredObjectives = useMemo(() => {
    let filtered = sortedObjectives;
    
    // 普通用户默认只显示自己的OKR，但创建人可以看到执行人的OKR
    if (!isAdmin) {
      // 获取当前用户作为创建人的所有OKR
      const myCreatedObjIds = new Set(objectives.filter(o => o.createdBy === user?.id).map(o => o.id));
      
      // 获取这些OKR下的所有KR的执行人ID
      const myCreatedKRAssignees = new Set<string>();
      keyResults.forEach(kr => {
        if (kr.objectiveId && myCreatedObjIds.has(kr.objectiveId) && kr.assigneeId) {
          myCreatedKRAssignees.add(kr.assigneeId);
        }
      });
      
      // 如果用户没有主动选择其他人，默认只显示自己的OKR
      const targetUserId = selectedUserId || user?.id;
      
      // 过滤逻辑：
      // 1. 显示目标用户创建的OKR
      // 2. 或者当前用户是创建人，且目标用户是该OKR下KR的执行人
      filtered = filtered.filter(o => {
        // 目标用户创建的OKR
        if (o.createdBy === targetUserId) return true;
        
        // 当前用户是创建人，且目标用户是该OKR的执行人
        if (o.createdBy === user?.id) {
          const objKRs = keyResults.filter(kr => kr.objectiveId === o.id);
          return objKRs.some(kr => kr.assigneeId === targetUserId);
        }
        
        return false;
      });
      
      // 普通用户只能看到自己部门的OKR
      if (myDeptIds.length > 0) {
        filtered = filtered.filter(o => myDeptIds.includes(o.departmentId));
      }
    } else {
      // 管理员逻辑
      if (isLeadershipRole) {
        const ownDeptIdSet = new Set(myDeptIds);
        const leadershipUserIds = new Set(
          allUsers
            .filter(u => u.role === 'center_head' || u.role === 'vp')
            .map(u => u.id)
        );
        filtered = filtered.filter(o => {
          if (ownDeptIdSet.has(o.departmentId)) return true;
          return !!o.createdBy && leadershipUserIds.has(o.createdBy);
        });
      }
      if (selectedDeptIds.length > 0) filtered = filtered.filter(o => selectedDeptIds.includes(o.departmentId));
      if (selectedUserId) filtered = filtered.filter(o => o.createdBy === selectedUserId);
    }
    
    if (selectedCycle) filtered = filtered.filter(o => o.cycle === selectedCycle);
    return filtered;
  }, [objectives, keyResults, selectedDeptIds, selectedUserId, selectedCycle, isAdmin, user, myDeptIds, isLeadershipRole, allUsers, sortedObjectives]);

  const cycles = useMemo(() => {
    const set = new Set(objectives.map(o => o.cycle));
    return Array.from(set);
  }, [objectives]);

  const groupedObjectives = useMemo(() => {
    const deptNameMap = new Map(departments.map(d => [d.id, d.name]));
    const deptIndexMap = new Map(departments.map((d, idx) => [d.id, idx]));
    const groupMap = new Map<string, { id: string; name: string; objectives: typeof filteredObjectives }>();

    filteredObjectives.forEach(obj => {
      const key = obj.departmentId || '__unknown__';
      const name = obj.departmentId ? (deptNameMap.get(obj.departmentId) || '未分配部门') : '未分配部门';
      const existing = groupMap.get(key);
      if (existing) {
        existing.objectives.push(obj);
      } else {
        groupMap.set(key, { id: key, name, objectives: [obj] });
      }
    });

    return Array.from(groupMap.values()).sort((a, b) => {
      const ai = deptIndexMap.has(a.id) ? (deptIndexMap.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
      const bi = deptIndexMap.has(b.id) ? (deptIndexMap.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
  }, [filteredObjectives, departments]);

  const shouldGroupByDepartmentView = myDeptIds.length > 1;

  useEffect(() => {
    if (hasInitializedCycleSelection.current || cycles.length === 0) return;

    const currentQuarterCycle = getCurrentQuarterCycle();
    setSelectedCycle(cycles.includes(currentQuarterCycle) ? currentQuarterCycle : null);
    hasInitializedCycleSelection.current = true;
  }, [cycles]);

  // 部门筛选：普通用户只能看到自己的中心，管理员可以看到所有中心
  const usedDepts = useMemo(() => {
    if (userRole === 'member') {
      // 普通用户只能看到自己所在的部门
      return departments.filter(d => myDeptIds.includes(d.id));
    }
    // 管理员可以看到所有有OKR的部门
    const ids = new Set(objectives.map(o => o.departmentId));
    return departments.filter(d => ids.has(d.id));
  }, [objectives, departments, userRole, myDeptIds]);

  const toggleDept = (id: string) => {
    setSelectedDeptIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
    setSelectedUserId(null);
  };

  const handleExport = async () => {
    if (isExporting) return;
    if (Platform.OS !== 'web') {
      Alert.alert('暂不支持', '当前仅支持网页端导出');
      return;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedDeptIds.length > 0) params.set('departmentIds', selectedDeptIds.join(','));
      if (selectedUserId) params.set('userId', selectedUserId);
      if (selectedCycle) params.set('cycle', selectedCycle);

      const url = buildUrl(`/api/export/okr${params.toString() ? `?${params.toString()}` : ''}`);
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || '导出失败');
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `okr_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('导出失败', err?.message || '请稍后重试');
    } finally {
      setIsExporting(false);
    }
  };

  const topPadding = Platform.OS === 'web' ? 20 : insets.top;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPadding, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderObjective = ({ item }: { item: typeof objectives[0] }) => {
    const objKRs = keyResults.filter(kr => kr.objectiveId === item.id);
    const dept = departments.find(d => d.id === item.departmentId);
    const avgProg = objKRs.length > 0
      ? Math.round(objKRs.reduce((s, kr) => s + kr.progress, 0) / objKRs.length)
      : 0;
    const completedCount = objKRs.filter(kr => kr.status === 'completed').length;
    const creator = allUsers.find(u => u.id === item.createdBy);

    return (
      <Pressable
        onPress={() => router.push({ pathname: '/objective/[id]', params: { id: item.id } })}
        style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
      >
        <View style={styles.cardTop}>
          <View style={[styles.statusDot, {
            backgroundColor: avgProg >= 70 ? Colors.success : avgProg >= 40 ? Colors.warning : avgProg > 0 ? Colors.danger : Colors.textTertiary
          }]} />
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        </View>
        {item.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.cardMeta}>
          <View style={styles.metaChip}>
            <Ionicons name="business-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{dept?.name || '未知'}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{item.cycle}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="key-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{objKRs.length} 个 KR</Text>
          </View>
          {creator && (
            <View style={styles.metaChip}>
              <Ionicons name="person-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{creator.displayName}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardProgress}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${avgProg}%`,
              backgroundColor: avgProg >= 70 ? Colors.success : avgProg >= 40 ? Colors.warning : Colors.danger,
            }]} />
          </View>
          <View style={styles.progressInfo}>
            <Text style={styles.progressPercent}>{avgProg}%</Text>
            <Text style={styles.progressCount}>{completedCount}/{objKRs.length} 已完成</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* 固定在顶部的标题栏 */}
      <View style={[styles.stickyHeader, { paddingTop: topPadding }]}> 
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <View style={styles.titleIconContainer}>
              <Ionicons name="flag" size={28} color="#0082EF" />
            </View>
            <View>
              <Text style={styles.mainTitle}>目标管理</Text>
              <Text style={styles.subtitle}>追踪团队目标进展</Text>
            </View>
          </View>
            
          {/* 功能按钮组 */}
          <View style={styles.actionButtons}>
            <NotificationBell />
            <Pressable
              onPress={handleExport}
              style={({ pressed }) => [styles.actionButton, styles.exportButton, { opacity: isExporting ? 0.5 : pressed ? 0.8 : 1 }]}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#0082EF" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#0082EF" />
              )}
            </Pressable>
            <Pressable 
              onPress={() => router.push('/import-okr')} 
              style={({ pressed }) => [styles.actionButton, styles.importButton, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#0082EF" />
            </Pressable>
              
            <Pressable 
              onPress={() => router.push('/create-objective')} 
              style={({ pressed }) => [styles.actionButton, styles.addButton, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }}
      >
        {/* 筛选器区域 - 卡片化设计 */}
        <View style={[styles.filterSection, { marginTop: topPadding + 100 }]}>
          <View style={styles.filterCard}>
            {/* 部门筛选器 */}
            {usedDepts.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>部门筛选</Text>
                <View style={styles.filterChipsContainer}>
                  {isAdmin ? (
                    <>
                      <Pressable
                        onPress={() => { setSelectedDeptIds([]); setSelectedUserId(null); }}
                        style={[styles.modernFilterChip, selectedDeptIds.length === 0 && styles.modernFilterChipActive]}
                      >
                        <Text style={[styles.modernFilterText, selectedDeptIds.length === 0 && styles.modernFilterTextActive]}>全部中心</Text>
                      </Pressable>
                      {usedDepts.map(d => {
                        const isActive = selectedDeptIds.includes(d.id);
                        return (
                          <Pressable key={d.id} onPress={() => toggleDept(d.id)} style={[styles.modernFilterChip, isActive && styles.modernFilterChipActive]}>
                            {isActive && <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />}
                            <Text style={[styles.modernFilterText, isActive && styles.modernFilterTextActive]}>{d.name}</Text>
                          </Pressable>
                        );
                      })}
                    </>
                  ) : (
                    usedDepts.map(d => (
                      <View key={d.id} style={[styles.modernFilterChip, styles.modernFilterChipActive]}>
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={[styles.modernFilterText, styles.modernFilterTextActive]}>{d.name}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* 人员筛选器 */}
            {showUserFilter && visibleUsers.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>人员筛选</Text>

                <View style={styles.userSearchBox}>
                  <Ionicons name="search-outline" size={16} color="#8F9BB3" />
                  <TextInput
                    value={userSearchKeyword}
                    onChangeText={setUserSearchKeyword}
                    placeholder="输入姓名搜索人员"
                    placeholderTextColor="#A0AEC0"
                    style={[
                      styles.userSearchInput,
                      Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none', borderWidth: 0 } as any) : null,
                    ]}
                    clearButtonMode="while-editing"
                    underlineColorAndroid="transparent"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.userFilterMetaRow}>
                  <Text style={styles.userFilterMetaText}>
                    {selectedUser ? `已选择：${selectedUser.displayName}` : (isAdmin ? '当前：全部人员（未指定）' : '当前：我')}
                  </Text>
                  {selectedUserId && (
                    <Pressable onPress={() => setSelectedUserId(null)} style={styles.userFilterClearBtn}>
                      <Text style={styles.userFilterClearText}>清除</Text>
                    </Pressable>
                  )}
                </View>

                {isAllCentersScope && userSearchKeyword.trim().length === 0 ? (
                  <Text style={styles.userFilterHintText}>人员数量较大，页面无法完整显示，请输入姓名进行搜索</Text>
                ) : (
                  <View style={styles.userFilterScrollViewport}>
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={displayedUsers.length > 8}
                      style={styles.userFilterScroll}
                      contentContainerStyle={styles.userFilterScrollContent}
                    >
                      {displayedUsers.length === 0 ? (
                        <Text style={styles.userFilterHintText}>{userSearchKeyword.trim().length > 0 ? '未找到匹配人员' : '暂无可选人员'}</Text>
                      ) : (
                        <View style={styles.filterChipsContainer}>
                          {displayedUsers.map(u => {
                            const isActive = selectedUserId === u.id || (selectedUserId === null && !isAdmin && u.id === user?.id);
                            return (
                              <Pressable key={u.id} onPress={() => setSelectedUserId(isActive ? null : u.id)} style={[styles.modernFilterChip, isActive && styles.modernFilterChipUserActive]}>
                                <Text style={[styles.modernFilterText, isActive && styles.modernFilterTextActive]}>{u.displayName}{u.id === user?.id ? ' (我)' : ''}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {/* 周期筛选器 */}
            {cycles.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={styles.filterGroupTitle}>周期筛选</Text>
                <View style={styles.filterChipsContainer}>
                  <Pressable
                    onPress={() => setSelectedCycle(null)}
                    style={[styles.modernFilterChip, !selectedCycle && styles.modernFilterChipActive]}
                  >
                    <Text style={[styles.modernFilterText, !selectedCycle && styles.modernFilterTextActive]}>全部周期</Text>
                  </Pressable>
                  {cycles.map(c => (
                    <Pressable
                      key={c}
                      onPress={() => setSelectedCycle(selectedCycle === c ? null : c)}
                      style={[styles.modernFilterChip, selectedCycle === c && styles.modernFilterChipActive]}
                    >
                      <Text style={[styles.modernFilterText, selectedCycle === c && styles.modernFilterTextActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 目标卡片列表 */}
        <View style={styles.objectivesList}>
          {filteredObjectives.length > 0 ? (
            shouldGroupByDepartmentView ? (
              groupedObjectives.map(group => {
                const isExpanded = expandedDeptIds[group.id] ?? groupedObjectives.length === 1;
                return (
                  <View key={group.id} style={styles.deptGroupCard}>
                    <Pressable
                      onPress={() => {
                        setExpandedDeptIds(prev => ({
                          ...prev,
                          [group.id]: !(prev[group.id] ?? groupedObjectives.length === 1),
                        }));
                      }}
                      style={styles.deptGroupHeader}
                    >
                      <View style={styles.deptGroupHeaderLeft}>
                        <Ionicons
                          name={isExpanded ? "chevron-down" : "chevron-forward"}
                          size={16}
                          color="#5E6D82"
                        />
                        <Text style={styles.deptGroupTitle}>{group.name}</Text>
                      </View>
                      <View style={styles.deptGroupCountChip}>
                        <Text style={styles.deptGroupCountText}>{group.objectives.length} 个 O</Text>
                      </View>
                    </Pressable>

                    {isExpanded && (
                      <View style={styles.deptGroupBody}>
                        {group.objectives.map(objective => renderObjective({ item: objective }))}
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              filteredObjectives.map(objective => renderObjective({ item: objective }))
            )
          ) : (
            <View style={styles.empty}>
              <Ionicons name="flag-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.emptyTitle}>暂无目标</Text>
              <Text style={styles.emptyText}>创建你的第一个目标，开始追踪进展</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  objectivesList: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  deptGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    marginBottom: 12,
    overflow: 'hidden',
  },
  deptGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FAFBFD',
  },
  deptGroupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deptGroupTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#171A1D',
  },
  deptGroupCountChip: {
    backgroundColor: '#EEF5FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deptGroupCountText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#2C7BE5',
  },
  deptGroupBody: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 2,
    borderTopWidth: 1,
    borderTopColor: '#F0F3F7',
  },
  
  // 固定在顶部的头部
  stickyHeader: { 
    backgroundColor: '#FFFFFF', 
    paddingHorizontal: 20, 
    paddingVertical: 16,
    borderBottomWidth: 1, 
    borderBottomColor: '#EBEEF5',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 100,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  titleSection: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start',
    marginTop: 16,
  },
  titleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  titleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#E6F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: { 
    fontFamily: 'Inter_800ExtraBold', 
    fontSize: 28, 
    color: '#171A1D', 
    letterSpacing: -0.5 
  },
  subtitle: { 
    fontFamily: 'Inter_400Regular', 
    fontSize: 14, 
    color: '#8F9BB3', 
    marginTop: 2 
  },
  actionButtons: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  actionButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  importButton: { 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: '#EBEEF5' 
  },
  exportButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBEEF5'
  },
  addButton: { 
    backgroundColor: '#0082EF' 
  },
  notificationArea: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  
  // 筛选器区域
  filterSection: {
    backgroundColor: '#F5F6F7',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#EBEEF5',
  },
  filterGroup: {
    marginBottom: 20,
  },
  filterGroupTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#171A1D',
    marginBottom: 12,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  userSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D9E2EC',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 38,
    marginBottom: 8,
  },
  userSearchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#171A1D',
    lineHeight: 18,
    paddingVertical: 0,
  },
  userFilterMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userFilterMetaText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#7A8AA0',
  },
  userFilterClearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#EEF5FF',
  },
  userFilterClearText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#2C7BE5',
  },
  userFilterScrollViewport: {
    maxHeight: 112,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5EAF2',
    backgroundColor: '#FCFDFF',
    overflow: 'hidden',
  },
  userFilterScroll: {},
  userFilterScrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  userFilterHintText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#8A97AA',
    textAlign: 'center',
    paddingVertical: 10,
  },
  modernFilterChip: { 
    flexDirection: 'row' as const, 
    alignItems: 'center' as const, 
    alignSelf: 'flex-start' as const,
    maxWidth: '100%',
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    backgroundColor: '#F5F6F7',
    borderWidth: 1,
    borderColor: '#EBEEF5',
  },
  modernFilterChipActive: { 
    backgroundColor: '#0082EF',
    borderColor: '#0082EF',
  },
  modernFilterChipUserActive: { 
    backgroundColor: '#52C41A',
    borderColor: '#52C41A',
  },
  modernFilterText: { 
    fontFamily: 'Inter_500Medium', 
    fontSize: 13, 
    color: '#5E6D82',
    flexShrink: 1,
  },
  modernFilterTextActive: { 
    color: '#FFFFFF' 
  },
  
  // 旧样式保持兼容
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EBEEF5' },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#171A1D', letterSpacing: -0.3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  importBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E6F4FF', alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0082EF', alignItems: 'center', justifyContent: 'center', shadowColor: '#0082EF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 },
  filters: { paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EBEEF5' },
  filterChip: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F5F6F7' },
  filterChipActive: { backgroundColor: '#0082EF' },
  filterChipUserActive: { backgroundColor: '#52C41A' },
  filterText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#5E6D82' },
  filterTextActive: { color: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#EBEEF5' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#171A1D', flex: 1 },
  cardDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#5E6D82', marginTop: 6, marginLeft: 20 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginLeft: 20 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F6F7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  metaText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#5E6D82' },
  cardProgress: { marginTop: 14, marginLeft: 20 },
  progressBar: { height: 4, backgroundColor: '#E8EAEF', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressPercent: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#171A1D' },
  progressCount: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8F9BB3' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#171A1D' },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#5E6D82', textAlign: 'center', paddingHorizontal: 40 },
});
