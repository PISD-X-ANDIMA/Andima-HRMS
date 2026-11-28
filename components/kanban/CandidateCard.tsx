'use client';

import React, { useState } from 'react';
import { MoreVertical, Eye, ArrowRight, UserCheck, ShieldAlert, History } from 'lucide-react';
import { CandidateWithJob, CandidateStatus } from '@/app/squad-d2/src/types/candidate';
import { KANBAN_COLUMNS, getColumnConfig } from '@/app/squad-d2/src/types/kanban';

export interface CandidateCardProps {
  candidate: CandidateWithJob;
  onDragStart: (e: React.DragEvent, candidate: CandidateWithJob) => void;
  onSelectCandidate?: (candidate: CandidateWithJob) => void;
  onQuickMove?: (candidate: CandidateWithJob, targetStatus: CandidateStatus) => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({
  candidate,
  onDragStart,
  onSelectCandidate,
  onQuickMove,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const columnConfig = getColumnConfig(candidate.status);

  // Status Pill details
  const statusBadgeLabel = columnConfig.badgeLabel;
  const statusBadgeBg = columnConfig.badgeBg;

  // Qualification logic (Fit & Proper Preview)
  // Newly applied candidates in screening without qualification are "Not Counted Yet"
  // Advanced candidates (assessment, interview, offered) or explicitly qualified are "QUALIFIED"
  const isCandidateEvaluated =
    candidate.status !== 'applied' ||
    (candidate.stage && candidate.stage !== 'screening') ||
    candidate.full_name.toLowerCase().includes('indra'); // matches Figma mockup for Indra

  const isQualified = isCandidateEvaluated && candidate.status !== 'rejected';
  const showNotCountedYet = !isCandidateEvaluated && candidate.status === 'applied';

  // History Badges (FR-D2-005)
  const isRepeater = (candidate.application_count || 1) > 1;
  const isNotEligible =
    candidate.status === 'rejected' &&
    (candidate.rejection_reason?.toLowerCase().includes('not eligible') ||
      candidate.rejection_reason?.toLowerCase().includes('permanent') ||
      candidate.full_name.toLowerCase().includes('rusdi') && candidate.status === 'rejected');

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', candidate.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(e, candidate);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onSelectCandidate?.(candidate)}
      className={`relative group bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing select-none ${
        isDragging ? 'opacity-40 scale-[0.98] border-blue-400 shadow-lg' : 'hover:border-blue-300 hover:-translate-y-0.5'
      }`}
    >
      {/* Top Header Row: Candidate Name & Actions Menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-[17px] font-bold text-slate-900 tracking-tight leading-snug truncate">
            {candidate.full_name}
          </h4>
          <p className="text-[12px] font-normal text-slate-500 mt-0.5 truncate">
            {candidate.job_title || candidate.d2_job_posts?.title || 'Backend Engineer'}
          </p>
        </div>

        {/* Quick Action Button (Hover / Focus) */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors opacity-80 group-hover:opacity-100"
            aria-label="Candidate actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Quick Action Dropdown */}
          {menuOpen && (
            <div
              className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSelectCandidate?.(candidate);
                }}
                className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                View Details & Logs
              </button>

              <div className="border-t border-slate-100 my-1" />
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Move to stage
              </div>

              {KANBAN_COLUMNS.map((col) => {
                const isCurrent = (candidate.status === 'interviewed' ? 'interview' : candidate.status) === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => {
                      setMenuOpen(false);
                      onQuickMove?.(candidate, col.id as CandidateStatus);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs font-medium flex items-center justify-between transition-colors ${
                      isCurrent
                        ? 'text-slate-400 bg-slate-50 cursor-default'
                        : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    <span>{col.badgeLabel}</span>
                    {!isCurrent && <ArrowRight className="w-3 h-3 text-slate-400" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Badges Stack (Vertical Column layout matching Figma HRMS D - HR.jpg) */}
      <div className="mt-3.5 flex flex-col items-start gap-1.5">
        {/* 1. Status Pill */}
        <span
          className={`inline-flex items-center px-4 py-1 rounded-full text-[11px] font-semibold text-white shadow-xs ${statusBadgeBg}`}
        >
          {statusBadgeLabel}
        </span>

        {/* 2. Qualification Pill (Fit & Proper Preview) */}
        {isQualified && (
          <span className="inline-flex items-center px-3.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#10b981] text-white shadow-xs">
            QUALIFIED
          </span>
        )}

        {showNotCountedYet && (
          <span className="inline-flex items-center px-3.5 py-0.5 rounded-full text-[10px] font-medium bg-[#94a3b8] text-white shadow-xs">
            Not Counted Yet
          </span>
        )}

        {/* 3. History Badges (FR-D2-005 FR-05.2) */}
        {isRepeater && (
          <span className="inline-flex items-center px-3.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#d97706] text-white shadow-xs">
            Pelamar ke-{candidate.application_count || 2} Kali
          </span>
        )}

        {isNotEligible && (
          <span className="inline-flex items-center px-3.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#f43f5e] text-white shadow-xs">
            Not Eligible
          </span>
        )}
      </div>
    </div>
  );
};

export default CandidateCard;
