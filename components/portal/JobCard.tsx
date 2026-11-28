'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { JobItem } from '@/app/squad-d2/src/types/job';

export interface JobCardProps {
  job: JobItem;
  onApply?: (job: JobItem) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onApply }) => {
  const router = useRouter();

  const handleApply = () => {
    if (job.isPlaceholder || job.title === 'XXX') return;
    if (onApply) {
      onApply(job);
    } else {
      router.push(`/registration-form?jobId=${encodeURIComponent(job.id)}`);
    }
  };

  // Render Placeholder / Coming Soon Card
  if (job.isPlaceholder || job.title === 'XXX') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between h-full select-none opacity-90 transition-shadow">
        <div>
          {/* Header XXX */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[22px] font-extrabold text-slate-800 tracking-wider">
              XXX
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
              Coming Soon
            </span>
          </div>

          {/* Wireframe Placeholder Lines */}
          <div className="space-y-2 mb-6">
            <div className="h-3 bg-slate-200/70 rounded-full w-full animate-pulse" />
            <div className="h-3 bg-slate-200/60 rounded-full w-5/6 animate-pulse" />
            <div className="h-3 bg-slate-200/50 rounded-full w-4/6 animate-pulse" />
          </div>

          {/* Wireframe Empty Pill Badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            <div className="h-7 w-20 rounded-full border border-slate-300 bg-slate-100/80" />
            <div className="h-7 w-24 rounded-full border border-slate-300 bg-slate-100/80" />
            <div className="h-7 w-16 rounded-full border border-slate-300 bg-slate-100/80" />
            <div className="h-7 w-28 rounded-full border border-slate-300 bg-slate-100/80" />
            <div className="h-7 w-20 rounded-full border border-slate-300 bg-slate-100/80" />
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
          {/* Location Wireframe */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-medium text-slate-400">---</span>
          </div>

          {/* Disabled Dark Gray Button */}
          <button
            type="button"
            disabled
            className="bg-[#475569] text-gray-300 font-bold px-6 py-2 rounded-xl text-sm cursor-not-allowed select-none transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    );
  }

  // Render Active Job Card
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 p-6 flex flex-col justify-between h-full group">
      <div>
        {/* Department Badge & Title */}
        <div className="mb-2">
          {job.department && (
            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-1 block">
              {job.department}
            </span>
          )}
          <h3 className="text-[22px] font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
            {job.title}
          </h3>
        </div>

        {/* Summary Description: 3-4 lines */}
        <p className="text-[13px] text-slate-600 leading-relaxed line-clamp-3 mb-5">
          {job.description}
        </p>

        {/* Qualification Tags (Pills): Minimal 4-5 oval pill badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          {job.tags && job.tags.length > 0 ? (
            job.tags.map((tag, idx) => (
              <span
                key={`${job.id}-tag-${idx}`}
                className="rounded-full border border-slate-400/80 px-3 py-1 text-xs text-slate-700 font-medium whitespace-nowrap bg-white/70"
              >
                {tag}
              </span>
            ))
          ) : (
            <>
              <span className="rounded-full border border-slate-400/80 px-3 py-1 text-xs text-slate-700 font-medium">Full Time</span>
              <span className="rounded-full border border-slate-400/80 px-3 py-1 text-xs text-slate-700 font-medium">Logistics</span>
              <span className="rounded-full border border-slate-400/80 px-3 py-1 text-xs text-slate-700 font-medium">Experience</span>
              <span className="rounded-full border border-slate-400/80 px-3 py-1 text-xs text-slate-700 font-medium">On-site</span>
            </>
          )}
        </div>
      </div>

      {/* Card Footer: Location + Apply CTA */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
        {/* Location */}
        <div className="flex items-center gap-1.5 text-slate-600">
          <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-700">
            {job.location || 'Indonesia'}
          </span>
        </div>

        {/* Apply CTA Button */}
        <button
          type="button"
          onClick={handleApply}
          className="bg-[#1d63ed] hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-6 py-2 rounded-xl text-sm transition-all duration-150 shadow-sm hover:shadow active:scale-[0.98] select-none"
        >
          Apply
        </button>
      </div>
    </div>
  );
};

export default JobCard;
