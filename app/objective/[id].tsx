import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, Alert, TextInput, FlatList, Modal, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useOKR } from '@/lib/okr-context';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/query-client';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

const STATUS_LABELS: Record<string, string> = {
  normal: '正常', behind: '滞后', completed: '已完成', overdue: '已逾期', paused: '已暂停',
};

function getStatusColor(status: string): string {
  switch (status) {
    case 'normal': return '#10B981';
    case 'behind': return '#F59E0B';
    case 'completed': return '#3B82F6';
    case 'overdue': return '#EF4444';
    case 'paused': return '#64748B';
    default: return '#94A3B8';
  }
}

function getScoreColor(score: number): string {
  if (score === 1) return '#10B981';
  if (score === 0.7) return '#3B82F6';
  if (score === 0.3) return '#F59E0B';
  return '#EF4444';
}

function getScoreLabel(score: number): string {
  if (score === 1) return '完全达成';
  if (score === 0.7) return '基本达成';
  if (score === 0.3) return '部分达成';
  return '未达成';
}

interface Comment {
  id: string;
  krId: string;
  userId: string;
  userName: string;
  content: string;
  mentionedUserIds: string[];
  createdAt: string;
}

interface SimpleUser {
  id: string;
  displayName: string;
  username: string;
}

export default function ObjectiveDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { objectives, keyResults, departments, removeObjective, removeKeyResult } = useOKR();
  const { user } = useAuth();

  const contextObjective = useMemo(() => objectives.find(o => o.id === id), [objectives, id]);
  const contextKRs = useMemo(() => keyResults.filter(kr => kr.objectiveId === id), [keyResults, id]);

  const [fetchedObjective, setFetchedObjective] = useState<any>(null);
  const [fetchedKRs, setFetchedKRs] = useState<any[]>([]);

  useEffect(() => {
    if (!contextObjective && id) {
      (async () => {
        try {
          const res = await apiRequest("GET", `/api/objectives/${id}`);
          const data = await res.json();
          setFetchedObjective(data.objective);
          setFetchedKRs(data.keyResults || []);
        } catch {}
      })();
    }
  }, [contextObjective, id]);

  const objective = contextObjective || fetchedObjective;
  const objKRs = contextObjective ? contextKRs : fetchedKRs;
  const dept = useMemo(() => departments.find(d => d.id === objective?.departmentId), [departments, objective]);

  const canEditObj = useMemo(() => {
    if (!user || !objective) return false;
    if (user.role === 'super_admin') return true;
    if (objective.createdBy === user.id) return true;
    return false;
  }, [user, objective]);

  const canEditKR = useCallback((kr: any) => {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    if (objective?.createdBy === user.id) return true;
    if (kr.assigneeId === user.id) return true;
    return false;
  }, [user, objective]);

  const [commentKrId, setCommentKrId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [mentionSearch, setMentionSearch] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest("GET", "/api/users/all-safe");
        setAllUsers(await res.json());
      } catch {}
    })();
  }, []);

  const loadComments = async (krId: string) => {
    try {
      const res = await apiRequest("GET", `/api/kr-comments/${krId}`);
      const data = await res.json();
      setComments(prev => ({ ...prev, [krId]: data }));
    } catch {}
  };

  useEffect(() => {
    objKRs.forEach(kr => loadComments(kr.id));
  }, [objKRs.length]);

  const handleSendComment = async () => {
    if (!commentKrId || !commentText.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await apiRequest("POST", "/api/kr-comments", {
        krId: commentKrId,
        content: commentText.trim(),
        mentionedUserIds: mentionedIds,
      });
      setCommentText('');
      setMentionedIds([]);
      await loadComments(commentKrId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setSendingComment(false);
  };

  const handleDeleteComment = async (commentId: string, krId: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm('确定删除该评论吗？')) {
        try {
          await apiRequest("DELETE", `/api/kr-comments/${commentId}`);
          await loadComments(krId);
        } catch {}
      }
    } else {
      Alert.alert('删除评论', '确定删除该评论吗？', [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: async () => {
          try {
            await apiRequest("DELETE", `/api/kr-comments/${commentId}`);
            await loadComments(krId);
          } catch {}
        }},
      ]);
    }
  };

  const insertMention = (mentionUser: SimpleUser) => {
    setCommentText(prev => prev + `@${mentionUser.displayName} `);
    if (!mentionedIds.includes(mentionUser.id)) {
      setMentionedIds(prev => [...prev, mentionUser.id]);
    }
    setShowMentionPicker(false);
    setMentionSearch('');
  };

  const filteredMentionUsers = useMemo(() => {
    return allUsers.filter(u => {
      if (u.id === user?.id) return false;
      if (!mentionSearch) return true;
      return u.displayName.includes(mentionSearch) || u.username.includes(mentionSearch);
    });
  }, [allUsers, mentionSearch, user]);

  const avgProgress = useMemo(() => {
    if (objKRs.length === 0) return 0;
    return Math.round(objKRs.reduce((s, kr) => s + kr.progress, 0) / objKRs.length);
  }, [objKRs]);

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;

  if (!objective) {
    return (
      <View style={[styles.container, { paddingTop: topPadding }]}>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.notFoundText}>目标未找到</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtnFallback}>
            <Text style={styles.backBtnText}>返回</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const handleDeleteObjective = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (Platform.OS === 'web') {
      if (window.confirm('此操作将删除该目标及其所有关键结果，确定删除吗？')) {
        await removeObjective(objective.id);
        router.back();
      }
    } else {
      Alert.alert('删除目标', '此操作将删除该目标及其所有关键结果。', [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: async () => { await removeObjective(objective.id); router.back(); } },
      ]);
    }
  };

  const handleDeleteKR = async (krId: string, krTitle: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (Platform.OS === 'web') {
      if (window.confirm(`确定删除"${krTitle}"吗？`)) {
        await removeKeyResult(krId);
      }
    } else {
      Alert.alert('删除关键结果', `确定删除"${krTitle}"吗？`, [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => removeKeyResult(krId) },
      ]);
    }
  };

  const renderHighlightedContent = (content: string) => {
    const parts = content.split(/(@\S+)/g);
    return (
      <Text style={styles.commentContent}>
        {parts.map((part, i) =>
          part.startsWith('@') ? (
            <Text key={i} style={styles.mentionHighlight}>{part}</Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.headerBar, { paddingTop: topPadding + 8 }]}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="chevron-back" size={28} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {canEditObj && (
          <>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/create-objective', params: { editId: objective.id } });
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginRight: 16 })}
            >
              <Ionicons name="pencil-outline" size={22} color={Colors.primary} />
            </Pressable>
            <Pressable onPress={handleDeleteObjective} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Ionicons name="trash-outline" size={22} color={Colors.danger} />
            </Pressable>
          </>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === 'web' ? 34 : 40 }]} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.objHeader}>
            <View style={styles.cycleBadge}>
              <Text style={styles.cycleBadgeText}>{objective.cycle}</Text>
            </View>
            <View style={styles.deptBadge}>
              <Ionicons name="business-outline" size={12} color={Colors.textSecondary} />
              <Text style={styles.deptBadgeText}>{dept?.name || '未知'}</Text>
            </View>
            <View style={[styles.deptBadge, { backgroundColor: (objective.okrType === '挑战型' ? '#F59E0B' : '#3B82F6') + '20' }]}>
              <Ionicons name={objective.okrType === '挑战型' ? "flash-outline" : "shield-checkmark-outline"} size={12} color={objective.okrType === '挑战型' ? '#F59E0B' : '#3B82F6'} />
              <Text style={[styles.deptBadgeText, { color: objective.okrType === '挑战型' ? '#F59E0B' : '#3B82F6' }]}>{objective.okrType || '承诺型'}</Text>
            </View>
            {objective.linkedToParent && (
              <View style={[styles.deptBadge, { backgroundColor: '#8B5CF6' + '20' }]}>
                <Ionicons name="git-merge-outline" size={12} color="#8B5CF6" />
                <Text style={[styles.deptBadgeText, { color: '#8B5CF6' }]}>关联上级</Text>
              </View>
            )}
            {objective.isCollaborative && (
              <View style={[styles.deptBadge, { backgroundColor: Colors.accent + '20' }]}>
                <Ionicons name="people-outline" size={12} color={Colors.accent} />
                <Text style={[styles.deptBadgeText, { color: Colors.accent }]}>跨部门协同</Text>
              </View>
            )}
          </View>

          <Text style={styles.objTitle}>{objective.title}</Text>

          <View style={styles.progressCard}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>整体进度</Text>
              <Text style={[styles.progressValue, {
                color: avgProgress >= 70 ? Colors.success : avgProgress >= 40 ? Colors.warning : Colors.danger
              }]}>{avgProgress}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {
                width: `${avgProgress}%`,
                backgroundColor: avgProgress >= 70 ? Colors.success : avgProgress >= 40 ? Colors.warning : Colors.danger,
              }]} />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <View style={styles.krHeader}>
            <Text style={styles.krSectionTitle}>关键结果 ({objKRs.length})</Text>
            {canEditObj && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: '/create-kr', params: { objectiveId: objective.id } });
                }}
                style={({ pressed }) => [styles.addKRBtn, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Ionicons name="add" size={18} color={Colors.primary} />
                <Text style={styles.addKRText}>添加 KR</Text>
              </Pressable>
            )}
          </View>

          {objKRs.length === 0 ? (
            <View style={styles.emptyKR}>
              <Ionicons name="key-outline" size={32} color={Colors.textTertiary} />
              <Text style={styles.emptyKRText}>暂无关键结果</Text>
            </View>
          ) : (
            objKRs.map((kr, idx) => {
              const krEditable = canEditKR(kr);
              const krComments = comments[kr.id] || [];
              const isCommenting = commentKrId === kr.id;
              return (
                <Animated.View key={kr.id} entering={FadeInDown.delay(300 + idx * 100).duration(300)} style={styles.krCard}>
                  <View style={styles.krTop}>
                    <View style={[styles.krStatusDot, { backgroundColor: getStatusColor(kr.status) }]} />
                    <Text style={styles.krTitle} numberOfLines={2}>{kr.title}</Text>
                  </View>
                  <View style={styles.krMeta}>
                    {kr.assigneeName ? (
                      <View style={styles.krMetaItem}>
                        <Ionicons name="person-outline" size={12} color={Colors.textSecondary} />
                        <Text style={styles.krMetaText}>{kr.assigneeName}</Text>
                      </View>
                    ) : null}
                    {kr.collaboratorName ? (
                      <View style={styles.krMetaItem}>
                        <Ionicons name="people-outline" size={12} color={Colors.info} />
                        <Text style={[styles.krMetaText, { color: Colors.info }]}>协同: {kr.collaboratorName}</Text>
                      </View>
                    ) : null}
                    <View style={styles.krMetaItem}>
                      <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
                      <Text style={styles.krMetaText}>{new Date(kr.endDate).toLocaleDateString('zh-CN')}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: getStatusColor(kr.status) + '20' }]}>
                      <Text style={[styles.statusChipText, { color: getStatusColor(kr.status) }]}>{STATUS_LABELS[kr.status] || kr.status}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: (kr.okrType === '挑战型' ? '#F59E0B' : '#3B82F6') + '15' }]}>
                      <Text style={[styles.statusChipText, { color: kr.okrType === '挑战型' ? '#F59E0B' : '#3B82F6' }]}>{kr.okrType || '承诺型'}</Text>
                    </View>
                  </View>
                  <View style={styles.krProgressRow}>
                    <View style={styles.krProgressBar}>
                      <View style={[styles.krProgressFill, { width: `${kr.progress}%`, backgroundColor: getStatusColor(kr.status) }]} />
                    </View>
                    <Text style={styles.krProgressText}>{kr.progress}%</Text>
                  </View>
                  {kr.selfScore !== null && (
                    <View style={styles.scoreSection}>
                      <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(kr.selfScore) + '20' }]}>
                        <Text style={[styles.scoreBadgeVal, { color: getScoreColor(kr.selfScore) }]}>{kr.selfScore}</Text>
                      </View>
                      <Text style={styles.scoreLabel}>{getScoreLabel(kr.selfScore)}</Text>
                    </View>
                  )}

                  <View style={styles.krActions}>
                    {krEditable && (
                      <>
                        <Pressable
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/create-kr', params: { objectiveId: objective.id, editId: kr.id } }); }}
                          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}
                        >
                          <Ionicons name="pencil-outline" size={16} color={Colors.info} />
                          <Text style={[styles.actionText, { color: Colors.info }]}>编辑</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/update-progress', params: { krId: kr.id } }); }}
                          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}
                        >
                          <Ionicons name="create-outline" size={16} color={Colors.primary} />
                          <Text style={styles.actionText}>更新进度</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/score-kr', params: { krId: kr.id } }); }}
                          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}
                        >
                          <Ionicons name="star-outline" size={16} color={Colors.accent} />
                          <Text style={[styles.actionText, { color: Colors.accent }]}>自评</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteKR(kr.id, kr.title)}
                          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.8 : 1 }]}
                        >
                          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                        </Pressable>
                      </>
                    )}
                    <Pressable
                      onPress={() => setCommentKrId(isCommenting ? null : kr.id)}
                      style={({ pressed }) => [styles.actionBtn, isCommenting && styles.actionBtnActive, { opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Ionicons name="chatbubble-outline" size={16} color={isCommenting ? Colors.white : Colors.primary} />
                      <Text style={[styles.actionText, isCommenting && { color: Colors.white }]}>评论 {krComments.length > 0 ? `(${krComments.length})` : ''}</Text>
                    </Pressable>
                  </View>

                  {krComments.length > 0 && (
                    <View style={styles.commentsSection}>
                      {krComments.map(c => (
                        <View key={c.id} style={styles.commentItem}>
                          <View style={styles.commentHeader}>
                            <View style={styles.commentAvatar}>
                              <Ionicons name="person" size={12} color={Colors.primary} />
                            </View>
                            <Text style={styles.commentUserName}>{c.userName}</Text>
                            <Text style={styles.commentTime}>{new Date(c.createdAt).toLocaleDateString('zh-CN')} {new Date(c.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
                            {c.userId === user?.id && (
                              <Pressable onPress={() => handleDeleteComment(c.id, kr.id)} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginLeft: 'auto' })}>
                                <Ionicons name="close-circle-outline" size={16} color={Colors.textTertiary} />
                              </Pressable>
                            )}
                          </View>
                          {renderHighlightedContent(c.content)}
                        </View>
                      ))}
                    </View>
                  )}

                  {isCommenting && (
                    <View style={styles.commentInputSection}>
                      <View style={styles.commentInputRow}>
                        <TextInput
                          style={styles.commentInput}
                          value={commentText}
                          onChangeText={setCommentText}
                          placeholder="输入评论..."
                          placeholderTextColor={Colors.textTertiary}
                          multiline
                        />
                        <Pressable onPress={() => setShowMentionPicker(true)} style={({ pressed }) => [styles.mentionBtn, { opacity: pressed ? 0.7 : 1 }]}>
                          <Text style={styles.mentionBtnText}>@</Text>
                        </Pressable>
                        <Pressable
                          onPress={handleSendComment}
                          disabled={!commentText.trim() || sendingComment}
                          style={({ pressed }) => [styles.sendBtn, { opacity: (!commentText.trim() || sendingComment) ? 0.4 : pressed ? 0.7 : 1 }]}
                        >
                          <Ionicons name="send" size={18} color={Colors.white} />
                        </Pressable>
                      </View>
                      {mentionedIds.length > 0 && (
                        <View style={styles.mentionedRow}>
                          <Text style={styles.mentionedLabel}>提到: </Text>
                          {mentionedIds.map(mid => {
                            const mu = allUsers.find(u => u.id === mid);
                            return mu ? (
                              <View key={mid} style={styles.mentionedChip}>
                                <Text style={styles.mentionedChipText}>@{mu.displayName}</Text>
                                <Pressable onPress={() => setMentionedIds(prev => prev.filter(x => x !== mid))}>
                                  <Ionicons name="close-circle" size={14} color={Colors.primary} />
                                </Pressable>
                              </View>
                            ) : null;
                          })}
                        </View>
                      )}
                    </View>
                  )}

                  {kr.progressHistory && kr.progressHistory.length > 0 && (
                    <View style={styles.historySection}>
                      <Text style={styles.historyTitle}>最近更新</Text>
                      {kr.progressHistory.slice(-3).reverse().map((entry: any) => (
                        <View key={entry.id} style={styles.historyItem}>
                          <View style={styles.historyDot} />
                          <View style={{ flex: 1 }}>
                            <View style={styles.historyTop}>
                              <Text style={styles.historyProgress}>{entry.progress}%</Text>
                              <Text style={styles.historyDate}>{new Date(entry.date).toLocaleDateString('zh-CN')}</Text>
                            </View>
                            {entry.note ? <Text style={styles.historyNote} numberOfLines={2}>{entry.note}</Text> : null}
                            {entry.images && entry.images.length > 0 && (
                              <View style={styles.historyImages}>
                                {entry.images.map((img: string, imgIdx: number) => (
                                  <Pressable key={imgIdx} onPress={() => setPreviewImage(img)} style={styles.historyThumb}>
                                    <Image source={{ uri: img }} style={styles.historyThumbImg} resizeMode="cover" />
                                  </Pressable>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </Animated.View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>

      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <Pressable style={styles.imagePreviewOverlay} onPress={() => setPreviewImage(null)}>
          {previewImage && (
            <Image source={{ uri: previewImage }} style={styles.imagePreviewFull} resizeMode="contain" />
          )}
          <Pressable onPress={() => setPreviewImage(null)} style={styles.imagePreviewClose}>
            <Ionicons name="close-circle" size={32} color={Colors.white} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showMentionPicker} transparent animationType="fade" onRequestClose={() => setShowMentionPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMentionPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>选择要@的人</Text>
            <TextInput
              style={styles.mentionSearchInput}
              value={mentionSearch}
              onChangeText={setMentionSearch}
              placeholder="搜索用户..."
              placeholderTextColor={Colors.textTertiary}
              autoFocus
            />
            <FlatList
              data={filteredMentionUsers}
              keyExtractor={item => item.id}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => insertMention(item)}
                  style={({ pressed }) => [styles.mentionUserItem, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={styles.mentionUserAvatar}>
                    <Ionicons name="person" size={14} color={Colors.primary} />
                  </View>
                  <Text style={styles.mentionUserName}>{item.displayName}</Text>
                  <Text style={styles.mentionUserUsername}>@{item.username}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.mentionEmpty}>无匹配用户</Text>}
            />
            <Pressable onPress={() => setShowMentionPicker(false)} style={({ pressed }) => [styles.modalCancelBtn, { opacity: pressed ? 0.7 : 1 }]}>
              <Text style={styles.modalCancelText}>取消</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F7' },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EBEEF5' },
  scrollContent: { paddingHorizontal: 16 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#5E6D82' },
  backBtnFallback: { backgroundColor: '#0082EF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  backBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  objHeader: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  cycleBadge: { backgroundColor: '#E6F4FF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8 },
  cycleBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#0082EF' },
  deptBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F6F7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  deptBadgeText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#5E6D82' },
  objTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, color: '#171A1D', marginBottom: 8 },
  progressCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 24, shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#EBEEF5' },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#5E6D82' },
  progressValue: { fontFamily: 'Inter_700Bold', fontSize: 20 },
  progressBar: { height: 6, backgroundColor: '#E8EAEF', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  krHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  krSectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 17, color: '#171A1D' },
  addKRBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E6F4FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addKRText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#0082EF' },
  emptyKR: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyKRText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#8F9BB3' },
  krCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2, borderWidth: 1, borderColor: '#EBEEF5' },
  krTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  krStatusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  krTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#171A1D', flex: 1 },
  krMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginLeft: 18 },
  krMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  krMetaText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#5E6D82' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusChipText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  krProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, marginLeft: 18 },
  krProgressBar: { flex: 1, height: 4, backgroundColor: '#E8EAEF', borderRadius: 2, overflow: 'hidden' },
  krProgressFill: { height: 4, borderRadius: 2 },
  krProgressText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#171A1D', width: 36, textAlign: 'right' },
  scoreSection: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginLeft: 18 },
  scoreBadge: { width: 36, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  scoreBadgeVal: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  scoreLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#5E6D82' },
  krActions: { flexDirection: 'row', gap: 10, marginTop: 12, marginLeft: 18, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F6F7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionBtnActive: { backgroundColor: '#0082EF' },
  actionText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#0082EF' },
  commentsSection: { marginTop: 12, marginLeft: 18, borderTopWidth: 1, borderTopColor: '#EBEEF5', paddingTop: 10 },
  commentItem: { marginBottom: 10 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  commentAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E6F4FF', alignItems: 'center', justifyContent: 'center' },
  commentUserName: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#171A1D' },
  commentTime: { fontFamily: 'Inter_400Regular', fontSize: 10, color: '#8F9BB3' },
  commentContent: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#171A1D', lineHeight: 18, marginLeft: 28 },
  mentionHighlight: { color: '#0082EF', fontFamily: 'Inter_600SemiBold' },
  commentInputSection: { marginTop: 8, marginLeft: 18 },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  commentInput: { flex: 1, backgroundColor: '#F5F6F7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, fontFamily: 'Inter_400Regular', color: '#171A1D', maxHeight: 80, borderWidth: 1, borderColor: '#EBEEF5' },
  mentionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E6F4FF', alignItems: 'center', justifyContent: 'center' },
  mentionBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#0082EF' },
  sendBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0082EF', alignItems: 'center', justifyContent: 'center' },
  mentionedRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  mentionedLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8F9BB3' },
  mentionedChip: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#E6F4FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  mentionedChipText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#0082EF' },
  historySection: { marginTop: 12, marginLeft: 18, borderTopWidth: 1, borderTopColor: '#EBEEF5', paddingTop: 10 },
  historyTitle: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#8F9BB3', marginBottom: 8 },
  historyItem: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  historyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8F9BB3', marginTop: 5 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between' },
  historyProgress: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#171A1D' },
  historyDate: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#8F9BB3' },
  historyNote: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#5E6D82', marginTop: 2 },
  historyImages: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  historyThumb: { width: 60, height: 60, borderRadius: 6, overflow: 'hidden', backgroundColor: '#E8EAEF' },
  historyThumbImg: { width: 60, height: 60 },
  imagePreviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  imagePreviewFull: { width: '90%', height: '70%' },
  imagePreviewClose: { position: 'absolute', top: 50, right: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: 320, maxHeight: 500, shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, color: '#171A1D', textAlign: 'center', marginBottom: 12 },
  mentionSearchInput: { backgroundColor: '#F5F6F7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Inter_400Regular', color: '#171A1D', marginBottom: 8, borderWidth: 1, borderColor: '#EBEEF5' },
  mentionUserItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EBEEF5' },
  mentionUserAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E6F4FF', alignItems: 'center', justifyContent: 'center' },
  mentionUserName: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#171A1D' },
  mentionUserUsername: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#8F9BB3' },
  mentionEmpty: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#8F9BB3', textAlign: 'center', paddingVertical: 20 },
  modalCancelBtn: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  modalCancelText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#5E6D82' },
});
