import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  MessageSquare,
  Phone,
  Video,
  UserPlus,
  Check,
  Ban,
  Heart,
  Send,
  Folder,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Post, PostComment } from '../../types';
import { PostMediaViewer } from '../feed/PostMediaViewer';
import { Avatar } from '../common/Avatar';

export const UserProfileModal: React.FC = () => {
  const {
    viewedUserProfile,
    viewedUserFolders,
    closeUserProfile,
    posts,
    postLikesByMe,
    postComments,
    commentLikesByMe,
    commentLikesCount,
    toggleLikePost,
    loadCommentsForPost,
    addCommentToPost,
    editComment,
    deleteComment,
    toggleLikeComment,
    startDirectChatWithUser,
    setActiveChatId,
    setActiveTab,
    startCall,
    chats,
  } = useChat();

  const {
    profile,
    isSubscribed,
    toggleSubscription,
    isUserBlocked,
    blockUser,
    unblockUser,
  } = useAuth();

  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [openCommentsPostIds, setOpenCommentsPostIds] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  if (!viewedUserProfile) return null;

  const isMe = profile?.uid === viewedUserProfile.uid;
  const subscribed = isSubscribed(viewedUserProfile.uid);
  const blocked = isUserBlocked(viewedUserProfile.uid);

  const userPosts = posts.filter(p => p.authorId === viewedUserProfile.uid);
  const activeFolder = viewedUserFolders.find(f => f.folderId === selectedFolderId);
  const displayedPosts =
    selectedFolderId === 'all' || !activeFolder
      ? userPosts
      : userPosts.filter(p => activeFolder.postIds?.includes(p.postId));

  const toggleCommentsSection = (post: Post) => {
    const next = !openCommentsPostIds[post.postId];
    setOpenCommentsPostIds(prev => ({ ...prev, [post.postId]: next }));
    if (next && !postComments[post.postId]) {
      loadCommentsForPost(post.postId, post.visibility);
    }
  };

  const handleMessageUser = async () => {
    const chatId = await startDirectChatWithUser(viewedUserProfile);
    setActiveChatId(chatId);
    setActiveTab('chats');
    closeUserProfile();
  };

  const handleCallUser = async (type: 'audio' | 'video') => {
    const chatId = await startDirectChatWithUser(viewedUserProfile);
    const foundChat = chats.find(c => c.chatId === chatId);
    setActiveChatId(chatId);
    setActiveTab('chats');
    closeUserProfile();
    if (foundChat) {
      await startCall(type, foundChat);
    }
  };

  const handleAddComment = async (post: Post, e: React.FormEvent) => {
    e.preventDefault();
    const text = commentInputs[post.postId];
    if (!text || !text.trim()) return;
    setCommentInputs(prev => ({ ...prev, [post.postId]: '' }));
    await addCommentToPost(post, text);
  };

  const handleSaveCommentEdit = async (post: Post, comment: PostComment) => {
    if (!editingCommentText.trim()) return;
    await editComment(post, comment, editingCommentText.trim());
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const formatTime = (ts?: any) => {
    if (!ts) return '';
    try {
      const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
      <div className="w-full max-w-2xl bg-[#EDEEF0] border border-[#E1E3E6] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden text-[#19191A] flex flex-col max-h-[92dvh] sm:max-h-[88vh]">
        {/* Шапка модального окна профиля */}
        <div className="px-5 py-3.5 border-b border-[#E1E3E6] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#19191A]">
              Страница @{viewedUserProfile.username}
            </span>
          </div>
          <button
            type="button"
            onClick={closeUserProfile}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-[#EDEFEF] text-[#818C99] hover:text-[#19191A] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Тело профиля */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Карточка пользователя */}
          <div className="bg-white border border-[#E1E3E6] rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 shadow-xs">
            <div className="relative shrink-0">
              <Avatar
                src={viewedUserProfile.avatarUrl}
                name={viewedUserProfile.displayName}
                className="w-20 h-20 rounded-full border border-[#E1E3E6] text-xl"
              />
              {viewedUserProfile.privacyLastSeen !== 'nobody' &&
                viewedUserProfile.status === 'online' && (
                  <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-[#4BB34B] ring-2 ring-white" />
                )}
            </div>

            <div className="flex-1 text-center sm:text-left min-w-0">
              <h3 className="text-lg font-bold text-[#19191A] truncate">
                {viewedUserProfile.displayName}
              </h3>
              <p className="text-xs text-[#818C99]">
                @{viewedUserProfile.username} ·{' '}
                {viewedUserProfile.privacyLastSeen === 'nobody'
                  ? 'статус скрыт'
                  : viewedUserProfile.status === 'online'
                  ? 'в сети'
                  : 'был(а) недавно'}
              </p>
              {viewedUserProfile.bio && (
                <p className="text-xs text-[#19191A] mt-1.5 break-words">
                  {viewedUserProfile.bio}
                </p>
              )}
              <div className="flex items-center justify-center sm:justify-start gap-4 mt-2.5 text-xs text-[#818C99]">
                <span>
                  Записей: <strong className="text-[#19191A]">{userPosts.length}</strong>
                </span>
                <span>
                  Папок: <strong className="text-[#19191A]">{viewedUserFolders.length}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Кнопки взаимодействия с пользователем */}
          {!isMe && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={handleMessageUser}
                className="py-2.5 px-3 rounded-[8px] bg-[#0077FF] hover:bg-[#0066EA] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>Написать</span>
              </button>

              <button
                type="button"
                onClick={() => handleCallUser('audio')}
                className="py-2.5 px-3 rounded-[8px] bg-white hover:bg-[#F2F3F5] border border-[#E1E3E6] text-[#2C3138] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Phone className="w-4 h-4 text-[#4BB34B] shrink-0" />
                <span>Позвонить</span>
              </button>

              <button
                type="button"
                onClick={() => toggleSubscription(viewedUserProfile.uid, 'user')}
                className="py-2.5 px-3 rounded-[8px] bg-white hover:bg-[#F2F3F5] border border-[#E1E3E6] text-[#2C3138] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {subscribed ? (
                  <Check className="w-4 h-4 text-[#4BB34B] shrink-0" />
                ) : (
                  <UserPlus className="w-4 h-4 text-[#0077FF] shrink-0" />
                )}
                <span>{subscribed ? 'Подписаны' : 'Подписаться'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  blocked
                    ? unblockUser(viewedUserProfile.uid)
                    : blockUser(viewedUserProfile.uid)
                }
                className={`py-2.5 px-3 rounded-[8px] border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  blocked
                    ? 'bg-[#E8F9E8] border-[#C8E6C9] text-[#2E7D32]'
                    : 'bg-[#FFEAEA] border-[#FFCCCC] text-[#E64646] hover:bg-[#FFD6D6]'
                }`}
              >
                <Ban className="w-4 h-4 shrink-0" />
                <span>{blocked ? 'Разблокировать' : 'Заблокировать'}</span>
              </button>
            </div>
          )}

          {/* Папки профиля пользователя */}
          <div className="bg-white border border-[#E1E3E6] rounded-xl p-3.5 space-y-2 shadow-xs">
            <div className="text-xs font-semibold text-[#818C99]">Папки и записи на стене</div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedFolderId('all')}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold shrink-0 flex items-center gap-1.5 cursor-pointer transition-all ${
                  selectedFolderId === 'all'
                    ? 'bg-[#0077FF] text-white shadow-xs'
                    : 'bg-[#F0F2F5] text-[#656565] hover:bg-[#E5E7EB] hover:text-[#19191A]'
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>Все записи ({userPosts.length})</span>
              </button>

              {viewedUserFolders.map(folder => {
                const count = userPosts.filter(p => folder.postIds?.includes(p.postId)).length;
                const isActive = selectedFolderId === folder.folderId;
                return (
                  <button
                    key={folder.folderId}
                    type="button"
                    onClick={() => setSelectedFolderId(folder.folderId)}
                    className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold shrink-0 flex items-center gap-1.5 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-[#0077FF] text-white shadow-xs'
                        : 'bg-[#F0F2F5] text-[#656565] hover:bg-[#E5E7EB] hover:text-[#19191A]'
                    }`}
                  >
                    <Folder
                      className={`w-3.5 h-3.5 ${
                        isActive ? 'text-white' : 'text-[#0077FF]'
                      }`}
                    />
                    <span>
                      {folder.name} ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Список публикаций пользователя */}
          <div className="space-y-3">
            {displayedPosts.length === 0 ? (
              <div className="bg-white border border-[#E1E3E6] rounded-xl p-6 text-center text-xs text-[#818C99] shadow-xs">
                В этой папке пока нет записей пользователя.
              </div>
            ) : (
              displayedPosts.map(post => {
                const isLiked = Boolean(postLikesByMe[post.postId]);
                const comments = postComments[post.postId] || [];

                return (
                  <div
                    key={post.postId}
                    className="bg-white border border-[#E1E3E6] rounded-xl p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-xs text-[#818C99]">
                      <span className="font-semibold text-[#2A5885]">{post.authorName}</span>
                      <span>{formatTime(post.createdAt)}</span>
                    </div>

                    {post.content && (
                      <p className="text-[14px] text-[#19191A] whitespace-pre-wrap break-words leading-relaxed">
                        {post.content}
                      </p>
                    )}

                    <PostMediaViewer post={post} />

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => toggleLikePost(post)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                          isLiked
                            ? 'bg-[#FFEAEA] text-[#E64646]'
                            : 'bg-[#F0F2F5] text-[#656565] hover:bg-[#E5E7EB]'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                        <span>{post.likesCount}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleCommentsSection(post)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                          openCommentsPostIds[post.postId]
                            ? 'bg-[#E5EBF1] text-[#0077FF]'
                            : 'bg-[#F0F2F5] text-[#656565] hover:bg-[#E5E7EB]'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>{post.commentsCount}</span>
                      </button>
                    </div>

                    {Boolean(openCommentsPostIds[post.postId]) && (
                      <div className="space-y-2.5 pt-2 border-t border-[#F2F3F5]">
                        {comments.length > 0 && (
                          <div className="space-y-2">
                            {comments.map(comment => {
                              const isMyComment = Boolean(
                                profile?.uid && comment.authorId === profile.uid
                              );
                              const commentLiked = Boolean(commentLikesByMe[comment.commentId]);
                              const commentLikes = commentLikesCount[comment.commentId] || 0;

                              return (
                                <div
                                  key={comment.commentId}
                                  className="flex items-start gap-2.5 text-xs"
                                >
                                  <Avatar
                                    src={comment.authorAvatar}
                                    name={comment.authorName}
                                    className="w-7 h-7 rounded-full shrink-0 mt-0.5 border border-[#E1E3E6]"
                                  />
                                  <div className="flex-1 bg-[#F5F6F8] rounded-xl p-2.5">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="font-semibold text-[#2A5885]">
                                        {comment.authorName}
                                      </span>
                                      <span className="text-[10px] text-[#818C99]">
                                        {formatTime(comment.createdAt)}
                                      </span>
                                    </div>

                                    {editingCommentId === comment.commentId ? (
                                      <div className="space-y-2 mt-1">
                                        <input
                                          type="text"
                                          value={editingCommentText}
                                          onChange={e => setEditingCommentText(e.target.value)}
                                          className="v7-input text-xs py-1"
                                        />
                                        <div className="flex justify-end gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => setEditingCommentId(null)}
                                            className="px-2 py-1 rounded bg-[#EDEFEF] text-[11px] text-[#656565] cursor-pointer"
                                          >
                                            Отмена
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSaveCommentEdit(post, comment)}
                                            className="px-2 py-1 rounded bg-[#0077FF] text-[11px] text-white cursor-pointer"
                                          >
                                            Сохранить
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-[#19191A] break-words">
                                        {comment.content}
                                      </p>
                                    )}

                                    <div className="flex items-center gap-3 mt-1.5">
                                      <button
                                        type="button"
                                        onClick={() => toggleLikeComment(comment.commentId)}
                                        className={`flex items-center gap-1 text-[11px] cursor-pointer ${
                                          commentLiked ? 'text-[#E64646]' : 'text-[#818C99]'
                                        }`}
                                      >
                                        <Heart
                                          className={`w-3 h-3 ${
                                            commentLiked ? 'fill-current' : ''
                                          }`}
                                        />
                                        <span>{commentLikes > 0 ? commentLikes : 'Нравится'}</span>
                                      </button>

                                      {isMyComment && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingCommentId(comment.commentId);
                                              setEditingCommentText(comment.content);
                                            }}
                                            className="flex items-center gap-1 text-[11px] text-[#818C99] hover:text-[#0077FF] cursor-pointer"
                                          >
                                            <Pencil className="w-2.5 h-2.5" />
                                            <span>Изм.</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => deleteComment(post, comment)}
                                            className="flex items-center gap-1 text-[11px] text-[#818C99] hover:text-[#E64646] cursor-pointer"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                            <span>Удалить</span>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <form
                          onSubmit={e => handleAddComment(post, e)}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="text"
                            placeholder="Написать комментарий..."
                            value={commentInputs[post.postId] || ''}
                            onChange={e =>
                              setCommentInputs({
                                ...commentInputs,
                                [post.postId]: e.target.value,
                              })
                            }
                            className="v7-input text-xs py-2 rounded-full"
                          />
                          <button
                            type="submit"
                            className="p-2 rounded-full bg-[#0077FF] hover:bg-[#0066EA] text-white cursor-pointer shrink-0"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
