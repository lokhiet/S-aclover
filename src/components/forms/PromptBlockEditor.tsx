import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CopyPlus,
  Edit3,
  Eye,
  FileText,
  GripVertical,
  Hash,
  Image as ImageIcon,
  ListOrdered,
  Loader2,
  Plus,
  Terminal,
  Trash2,
  Upload,
} from 'lucide-react';
import type { PromptBlock, PromptBlockType } from '../../types';
import {
  PROMPT_BLOCK_META,
  PROMPT_BLOCK_TYPE_ORDER,
  computeBlockStepNumbers,
  createEmptyPromptBlock,
  createPromptBlockId,
  isSafeImageUrl,
} from '../../utils/contentBlocks';
import { uploadPromptIllustration } from '../../services/mediaService';
import { PromptImageViewer } from '../common/PromptImageViewer';
import { PromptBlocksView } from '../prompts/PromptBlocksView';

interface PromptBlockEditorProps {
  postTitle: string;
  description: string;
  howToUse?: string;
  blocks: PromptBlock[];
  autoNumberSteps: boolean;
  onChangeBlocks: (nextBlocks: PromptBlock[]) => void;
  onChangeAutoNumberSteps: (nextAutoNumber: boolean) => void;
  onTrackSessionUpload?: (storagePath: string) => void;
  isAuthenticated?: boolean;
  userId?: string;
  targetType: 'note' | 'library_prompt';
  draftItemId: string;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

function getBlockTypeIcon(type: PromptBlockType, className = 'w-3.5 h-3.5') {
  switch (type) {
    case 'prompt':
      return <Terminal className={className} />;
    case 'guide':
      return <BookOpen className={className} />;
    case 'note':
      return <AlertTriangle className={className} />;
    case 'example':
      return <FileText className={className} />;
    case 'heading':
      return <Hash className={className} />;
    case 'image':
      return <ImageIcon className={className} />;
  }
}

export function PromptBlockEditor({
  postTitle,
  description,
  howToUse,
  blocks,
  autoNumberSteps,
  onChangeBlocks,
  onChangeAutoNumberSteps,
  onTrackSessionUpload,
  isAuthenticated = false,
  userId,
  targetType,
  draftItemId,
  onToast,
}: PromptBlockEditorProps) {
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [uploadErrorMap, setUploadErrorMap] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const stepNumbers = computeBlockStepNumbers(blocks, autoNumberSteps);

  const handleAddBlock = (type: PromptBlockType, insertAfterIndex?: number) => {
    const newBlock = createEmptyPromptBlock(type);
    if (typeof insertAfterIndex === 'number') {
      const next = [...blocks];
      next.splice(insertAfterIndex + 1, 0, newBlock);
      onChangeBlocks(next);
    } else {
      onChangeBlocks([...blocks, newBlock]);
    }
  };

  const handleUpdateBlock = (index: number, patch: Partial<PromptBlock>) => {
    onChangeBlocks(
      blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    );
  };

  const handleChangeBlockType = (index: number, nextType: PromptBlockType) => {
    const current = blocks[index];
    const currentType = current.type || 'prompt';
    const currentDefault = PROMPT_BLOCK_META[currentType].defaultTitle;
    const nextDefault = PROMPT_BLOCK_META[nextType].defaultTitle;
    const shouldReplaceTitle = !current.label.trim() || current.label.trim() === currentDefault;

    handleUpdateBlock(index, {
      type: nextType,
      label: shouldReplaceTitle ? (nextType === 'heading' ? '' : nextDefault) : current.label,
      autoNumber: PROMPT_BLOCK_META[nextType].supportsAutoNumber,
    });
  };

  const handleDuplicateBlock = (index: number) => {
    const target = blocks[index];
    const copy: PromptBlock = {
      ...target,
      id: createPromptBlockId(),
      label: target.label ? `${target.label} (Bản sao)` : '',
    };
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    onChangeBlocks(next);
  };

  const handleDeleteBlock = (index: number) => {
    if (blocks.length <= 1) {
      onChangeBlocks([createEmptyPromptBlock('prompt')]);
      return;
    }
    onChangeBlocks(blocks.filter((_, i) => i !== index));
  };

  const handleMoveBlock = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= blocks.length || fromIndex === toIndex) return;
    const next = [...blocks];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChangeBlocks(next);
  };

  const toggleCollapse = (blockKey: string) => {
    setCollapsedMap((prev) => ({ ...prev, [blockKey]: !prev[blockKey] }));
  };

  const handleUploadImageForBlock = async (index: number, blockKey: string, file: File) => {
    if (!isAuthenticated || !userId) {
      setUploadErrorMap((prev) => ({
        ...prev,
        [blockKey]: 'Vui lòng đăng nhập để tải ảnh riêng tư từ thiết bị.',
      }));
      return;
    }

    setUploadingBlockId(blockKey);
    setUploadErrorMap((prev) => ({ ...prev, [blockKey]: '' }));

    try {
      const res = await uploadPromptIllustration(userId, targetType, draftItemId, file);
      if (!res.ok || !res.storagePath) {
        setUploadErrorMap((prev) => ({
          ...prev,
          [blockKey]: res.error || 'Không thể tải ảnh minh họa.',
        }));
        return;
      }

      onTrackSessionUpload?.(res.storagePath);
      handleUpdateBlock(index, {
        imagePath: res.storagePath,
      });
      onToast?.('Đã tải hình ảnh minh họa lên thành công!', 'success');
    } finally {
      setUploadingBlockId(null);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Editor Toolbar: Mode Switch + Step Numbering Mode */}
      <div className="retro-callout-mint p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-[#A8CEB8] dark:border-[#49554D] overflow-hidden bg-[#FFFDF7] dark:bg-[#202423]">
            <button
              type="button"
              onClick={() => setEditorMode('edit')}
              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                editorMode === 'edit'
                  ? 'bg-[#39755D] dark:bg-[#A3BDA8] text-[#FFF9EA] dark:text-[#202423]'
                  : 'text-[#48685A] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/50 dark:hover:bg-[#343D37]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Soạn thảo ({blocks.length} khối)</span>
            </button>
            <button
              type="button"
              onClick={() => setEditorMode('preview')}
              className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                editorMode === 'preview'
                  ? 'bg-[#39755D] dark:bg-[#A3BDA8] text-[#FFF9EA] dark:text-[#202423]'
                  : 'text-[#48685A] dark:text-[#B8BDB5] hover:bg-[#E2F3E8]/50 dark:hover:bg-[#343D37]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem trước bài đăng</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeAutoNumberSteps(!autoNumberSteps)}
            className={`retro-btn px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer ${
              autoNumberSteps ? 'retro-btn-active' : ''
            }`}
            title="Bật để tự động đánh số 1, 2, 3 cho các bước Câu lệnh / Hướng dẫn"
          >
            <ListOrdered className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
            <span>
              {autoNumberSteps ? 'Đánh số bước tự động: BẬT' : 'Tiêu đề thủ công (Không đánh số)'}
            </span>
          </button>
        </div>
      </div>

      {/* LIVE PREVIEW MODE */}
      {editorMode === 'preview' ? (
        <div className="rounded-lg border border-dashed border-[#8DBB9F] dark:border-[#49554D] bg-[#F5FAF7] dark:bg-[#202423] p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#D5E6DC] dark:border-[#49554D]">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#39755D] dark:text-[#A3BDA8]">
              Bản Xem Trước Trực Tiếp
            </span>
            <button
              type="button"
              onClick={() => setEditorMode('edit')}
              className="retro-btn px-2.5 py-1 text-[11px] font-semibold cursor-pointer"
            >
              Quay lại chỉnh sửa
            </button>
          </div>

          {postTitle.trim() && (
            <h3 className="text-base sm:text-lg font-bold text-[#224C3B] dark:text-[#E4E1D8] break-words">
              {postTitle.trim()}
            </h3>
          )}

          <PromptBlocksView
            postKey={`preview-${draftItemId}`}
            title={postTitle}
            description={description}
            howToUse={howToUse}
            blocks={blocks}
            autoNumberSteps={autoNumberSteps}
            defaultPromptsExpanded
            onCopyText={(text, label) => {
              if (navigator?.clipboard) {
                void navigator.clipboard.writeText(text);
              }
              onToast?.(`Đã sao chép thử: ${label}`, 'info');
            }}
          />
        </div>
      ) : (
        /* BLOCK COMPOSER MODE */
        <div className="space-y-3">
          {blocks.map((block, index) => {
            const type = block.type || 'prompt';
            const meta = PROMPT_BLOCK_META[type];
            const blockKey = block.id || `edit-blk-${index}`;
            const isCollapsed = Boolean(collapsedMap[blockKey]);
            const stepNum = stepNumbers[index];
            const isDragging = dragIndex === index;
            const isDragTarget = dragOverIndex === index && dragIndex !== index;
            const isUploading = uploadingBlockId === blockKey;
            const uploadErr = uploadErrorMap[blockKey];
            const hasInvalidExternalImg =
              type === 'image' &&
              Boolean(block.imageUrl?.trim()) &&
              !isSafeImageUrl(block.imageUrl);

            return (
              <div
                key={blockKey}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  if (dragOverIndex !== index) setDragOverIndex(index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== index) {
                    handleMoveBlock(dragIndex, index);
                  }
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                className={`retro-window overflow-hidden transition-all ${
                  isDragging ? 'opacity-60' : ''
                } ${
                  isDragTarget
                    ? 'ring-2 ring-[#39755D] dark:ring-[#A3BDA8]'
                    : ''
                }`}
              >
                {/* Block Card Header */}
                <div className="retro-window-header px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* Drag Handle */}
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        setDragIndex(index);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(index));
                      }}
                      className="p-1 rounded text-[#587568] dark:text-[#B8BDB5] hover:bg-[#FFF9EA] dark:hover:bg-[#343D37] cursor-grab active:cursor-grabbing shrink-0"
                      title="Kéo thả để sắp xếp lại vị trí khối"
                      aria-label="Kéo để di chuyển khối"
                    >
                      <GripVertical className="w-4 h-4" />
                    </button>

                    {/* Collapse toggle */}
                    <button
                      type="button"
                      onClick={() => toggleCollapse(blockKey)}
                      className="p-1 rounded text-[#39755D] dark:text-[#A3BDA8] hover:bg-[#FFF9EA] dark:hover:bg-[#343D37] cursor-pointer shrink-0"
                      title={isCollapsed ? 'Mở rộng khối' : 'Thu gọn khối'}
                      aria-label={isCollapsed ? 'Mở rộng khối' : 'Thu gọn khối'}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {/* Step badge */}
                    {stepNum !== null && (
                      <span className="w-5 h-5 rounded bg-[#39755D] dark:bg-[#343D37] text-[#FFF9EA] dark:text-[#A3BDA8] dark:border dark:border-[#49554D] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                        {stepNum}
                      </span>
                    )}

                    {/* Type selector */}
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-[#39755D] dark:text-[#A3BDA8] hidden sm:inline">
                        {getBlockTypeIcon(type, 'w-3.5 h-3.5')}
                      </span>
                      <select
                        value={type}
                        onChange={(e) =>
                          handleChangeBlockType(index, e.target.value as PromptBlockType)
                        }
                        aria-label="Loại khối nội dung"
                        className="retro-input h-7 px-2 text-[11px] font-bold cursor-pointer max-w-[170px]"
                      >
                        {PROMPT_BLOCK_TYPE_ORDER.map((optType) => (
                          <option key={optType} value={optType}>
                            {PROMPT_BLOCK_META[optType].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isCollapsed && (
                      <span className="text-xs text-[#48685A] dark:text-[#B8BDB5] truncate ml-1">
                        — {block.label || meta.defaultTitle}
                      </span>
                    )}
                  </div>

                  {/* Block Actions: Up, Down, Duplicate, Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveBlock(index, index - 1)}
                      className="retro-btn p-1 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                      title="Di chuyển lên"
                      aria-label="Di chuyển lên"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                    </button>

                    <button
                      type="button"
                      disabled={index === blocks.length - 1}
                      onClick={() => handleMoveBlock(index, index + 1)}
                      className="retro-btn p-1 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                      title="Di chuyển xuống"
                      aria-label="Di chuyển xuống"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicateBlock(index)}
                      className="retro-btn p-1 cursor-pointer"
                      title="Nhân bản khối này"
                      aria-label="Nhân bản khối"
                    >
                      <CopyPlus className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteBlock(index)}
                      className="retro-btn-danger p-1 cursor-pointer"
                      title="Xóa khối này"
                      aria-label="Xóa khối"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Block Body */}
                {!isCollapsed && (
                  <div className="p-3 sm:p-3.5 space-y-2.5 bg-[#FFFDF7]/70 dark:bg-[#292E2B]">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        type="text"
                        value={block.label}
                        onChange={(e) => handleUpdateBlock(index, { label: e.target.value })}
                        placeholder={
                          type === 'heading'
                            ? 'Nhập tiêu đề phân mục (ví dụ: Phần 1 — Thiết lập bối cảnh)...'
                            : `Tiêu đề khối (mặc định: ${meta.defaultTitle})`
                        }
                        className="retro-input flex-1 px-2.5 py-1.5 text-xs font-semibold"
                      />

                      {autoNumberSteps && meta.supportsAutoNumber && (
                        <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#48685A] dark:text-[#B8BDB5] cursor-pointer shrink-0 select-none">
                          <input
                            type="checkbox"
                            checked={block.autoNumber !== false}
                            onChange={(e) =>
                              handleUpdateBlock(index, { autoNumber: e.target.checked })
                            }
                            className="accent-[#39755D] rounded cursor-pointer"
                          />
                          <span>Đánh số bước</span>
                        </label>
                      )}
                    </div>

                    {type === 'image' ? (
                      <div className="space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <input
                            ref={(el) => {
                              fileInputRefs.current[blockKey] = el;
                            }}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (file) {
                                void handleUploadImageForBlock(index, blockKey, file);
                              }
                            }}
                          />

                          <button
                            type="button"
                            disabled={isUploading || !isAuthenticated}
                            onClick={() => fileInputRefs.current[blockKey]?.click()}
                            className="retro-btn px-3 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                            title={
                              isAuthenticated
                                ? 'Tải ảnh từ máy tính hoặc điện thoại (tối đa 5 MB)'
                                : 'Đăng nhập để tải ảnh riêng tư từ thiết bị'
                            }
                          >
                            {isUploading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#39755D] dark:text-[#A3BDA8]" />
                            ) : (
                              <Upload className="w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]" />
                            )}
                            <span>
                              {isUploading
                                ? 'Đang tải ảnh...'
                                : block.imagePath
                                  ? 'Đổi ảnh từ thiết bị'
                                  : 'Tải ảnh từ thiết bị'}
                            </span>
                          </button>

                          <input
                            type="url"
                            value={block.imageUrl || ''}
                            onChange={(e) =>
                              handleUpdateBlock(index, { imageUrl: e.target.value })
                            }
                            placeholder="Hoặc dán URL ảnh HTTPS (https://...)..."
                            className={`retro-input flex-1 px-2.5 py-1.5 text-xs font-mono ${
                              hasInvalidExternalImg ? 'border-red-500 dark:border-[#9A666B]' : ''
                            }`}
                          />

                          {(block.imagePath || block.imageUrl) && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateBlock(index, {
                                  imagePath: undefined,
                                  imageUrl: undefined,
                                })
                              }
                              className="retro-btn-danger px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer shrink-0"
                            >
                              Gỡ ảnh
                            </button>
                          )}
                        </div>

                        {!isAuthenticated && (
                          <p className="text-[11px] text-[#5B786B] dark:text-[#B8BDB5]">
                            Mẹo: Đăng nhập tài khoản để tải ảnh trực tiếp từ thiết bị (tự bảo vệ theo chế độ Riêng tư/Công khai). Ở chế độ Khách, bạn có thể dán URL ảnh HTTPS.
                          </p>
                        )}

                        {hasInvalidExternalImg && (
                          <p className="text-[11px] font-medium text-red-700 dark:text-[#E4A6AA]">
                            URL ảnh bên ngoài cần bắt đầu bằng https:// để bảo đảm an toàn.
                          </p>
                        )}

                        {uploadErr && (
                          <p className="text-[11px] font-medium text-red-700 dark:text-[#E4A6AA]">
                            {uploadErr}
                          </p>
                        )}

                        {(block.imagePath || isSafeImageUrl(block.imageUrl)) && (
                          <PromptImageViewer
                            imagePath={block.imagePath}
                            imageUrl={block.imageUrl}
                            caption={block.imageCaption}
                            alt={block.label}
                          />
                        )}

                        <input
                          type="text"
                          value={block.imageCaption ?? block.content}
                          onChange={(e) =>
                            handleUpdateBlock(index, {
                              imageCaption: e.target.value,
                              content: e.target.value,
                            })
                          }
                          placeholder="Chú thích ảnh minh họa (không bắt buộc)..."
                          className="retro-input w-full px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    ) : (
                      <textarea
                        rows={type === 'prompt' ? 4 : type === 'heading' ? 2 : 3}
                        value={block.content}
                        onChange={(e) => handleUpdateBlock(index, { content: e.target.value })}
                        placeholder={meta.contentPlaceholder}
                        className={`retro-input w-full px-3 py-2 text-xs leading-relaxed resize-y ${
                          type === 'prompt' || type === 'example' ? 'font-mono' : 'sm:text-sm'
                        }`}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Quick-Add Block Bar */}
          <div className="rounded-md border border-dashed border-[#A8CEB8] dark:border-[#49554D] bg-[#F4FAF6] dark:bg-[#202423] p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2B5A47] dark:text-[#A3BDA8]">
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm khối nội dung mới</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_BLOCK_TYPE_ORDER.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleAddBlock(type)}
                  className="retro-btn px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {getBlockTypeIcon(type, 'w-3.5 h-3.5 text-[#39755D] dark:text-[#A3BDA8]')}
                  <span>+ {PROMPT_BLOCK_META[type].shortLabel}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
