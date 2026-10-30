import React, { useState } from 'react';

export default function ReviewSection({
  title,
  aiSource = 'Suggested from dictation',
  children,
  defaultContent,
  onSave,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(defaultContent || '');
  const [isAccepted, setIsAccepted] = useState(false);

  const handleAccept = () => {
    setIsAccepted(true);
    setIsEditing(false);
    if (onSave) onSave(content);
  };

  return (
    <div className={`w-full bg-surface-container-lowest rounded-xl p-4 shadow-sm border transition-all ${
      isAccepted ? 'border-secondary/40' : 'border-outline-variant/30'
    }`}>
      {/* Header with Title and AI Provenance Badge */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2">
        <h2 className="text-headline-sm text-primary font-bold">{title}</h2>
        {aiSource && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-label-sm font-semibold">
            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
            {aiSource}
          </span>
        )}
      </div>

      {/* Main Content Area */}
      <div className="py-2">
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full p-3 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        ) : children ? (
          children
        ) : (
          <p className="text-body-md text-on-surface leading-relaxed">{content}</p>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-container flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {isAccepted ? (
            <span className="inline-flex items-center gap-1 text-label-sm text-secondary font-bold">
              <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
              Accepted by Attending Clinician
            </span>
          ) : (
            <span className="text-[12px] text-outline">Pending doctor confirmation</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="min-h-[40px] px-3 rounded-lg text-on-surface-variant hover:text-primary font-bold text-label-sm flex items-center gap-1 hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isEditing ? 'close' : 'edit'}
            </span>
            <span>{isEditing ? 'Cancel Edit' : 'Edit'}</span>
          </button>

          <button
            onClick={handleAccept}
            className={`min-h-[40px] px-3.5 rounded-lg font-bold text-label-sm flex items-center gap-1 transition-all ${
              isAccepted
                ? 'bg-secondary text-on-secondary'
                : 'bg-primary-container text-on-primary hover:bg-primary shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">check</span>
            <span>{isAccepted ? 'Accepted' : 'Accept'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
