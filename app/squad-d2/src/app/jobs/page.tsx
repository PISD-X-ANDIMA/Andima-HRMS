'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Search, Briefcase, RefreshCw, XCircle } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { JobCard } from '@/components/portal/JobCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { JobItem } from '../../types/job';
import { getJobsAction } from './actions';

export default function JobListPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Load jobs on initial mount
  useEffect(() => {
    let isMounted = true;
    startTransition(async () => {
      try {
        const fetched = await getJobsAction();
        if (isMounted) {
          setJobs(fetched);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load jobs:', err);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter jobs based on real-time search query (FR-01.2 & Search Requirement)
  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return jobs;

    return jobs.filter((job) => {
      // Placeholder card always shows unless specifically filtered or can remain at the end
      if (job.isPlaceholder || job.title === 'XXX') {
        return 'xxx'.includes(q) || 'coming soon'.includes(q);
      }

      const matchTitle = job.title.toLowerCase().includes(q);
      const matchDept = job.department ? job.department.toLowerCase().includes(q) : false;
      const matchLoc = job.location ? job.location.toLowerCase().includes(q) : false;
      const matchTags = job.tags ? job.tags.some((t) => t.toLowerCase().includes(q)) : false;
      const matchDesc = job.description ? job.description.toLowerCase().includes(q) : false;

      return matchTitle || matchDept || matchLoc || matchTags || matchDesc;
    });
  }, [jobs, searchQuery]);

  const handleApply = (job: JobItem) => {
    if (job.isPlaceholder || job.title === 'XXX') return;
    router.push(`/register?jobId=${encodeURIComponent(job.id)}`);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row text-slate-800 font-sans antialiased">
      {/* ========================================================================= */}
      {/* 1. SIDEBAR NAVIGASI KIRI (Dark Navy #0b1329)                             */}
      {/* ========================================================================= */}
      <Sidebar />

      {/* ========================================================================= */}
      {/* 2. AREA KONTEN UTAMA                                                      */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Navigation Bar */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Main Content Body */}
        <main className="flex-1 px-4 sm:px-6 md:px-10 lg:px-12 py-8 max-w-7xl w-full mx-auto">
          {/* Header Title & Description Section */}
          <div className="mb-6">
            <h1 className="text-[32px] font-bold text-slate-900 tracking-tight leading-tight">
              JOB LIST
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-normal">
              Track and Trace all jobs posted at PT Andima Transportindo.
            </p>
          </div>

          {/* Search Input Bar (Client-side real-time filter) */}
          <div className="mb-8 max-w-xl">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search Spesific Job"
              id="search-specific-job"
            />
          </div>

          {/* Real-Time Filter Summary Bar */}
          {searchQuery && (
            <div className="mb-6 flex items-center justify-between bg-blue-50/70 border border-blue-100 px-4 py-2.5 rounded-xl text-xs text-blue-900 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  Showing results for &ldquo;<strong className="font-semibold">{searchQuery}</strong>&rdquo;
                  {' '}({filteredJobs.length} {filteredJobs.length === 1 ? 'position' : 'positions'} found)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 ml-2"
              >
                Clear
              </button>
            </div>
          )}

          {/* Loading Skeleton Indicator */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div
                  key={`skeleton-${idx}`}
                  className="bg-white rounded-2xl border border-slate-200/80 p-6 h-72 animate-pulse flex flex-col justify-between"
                >
                  <div>
                    <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
                    <div className="h-6 bg-slate-200 rounded w-3/4 mb-4" />
                    <div className="space-y-2 mb-6">
                      <div className="h-3 bg-slate-100 rounded w-full" />
                      <div className="h-3 bg-slate-100 rounded w-5/6" />
                      <div className="h-3 bg-slate-100 rounded w-4/6" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 bg-slate-100 rounded-full w-16" />
                      <div className="h-6 bg-slate-100 rounded-full w-20" />
                      <div className="h-6 bg-slate-100 rounded-full w-14" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="h-4 bg-slate-200 rounded w-24" />
                    <div className="h-9 bg-slate-200 rounded-xl w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            /* Empty Search Results State */
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center max-w-lg mx-auto shadow-sm my-12">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Briefcase className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">
                No matching positions found
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                We couldn&apos;t find any open position matching &ldquo;{searchQuery}&rdquo;. Try adjusting your keywords or clearing the search.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors"
              >
                Reset Search
              </button>
            </div>
          ) : (
            /* Responsive Job Cards Grid */
            /* Desktop (lg:, xl:): 3 Kolom | Tablet (md:): 2 Kolom | Mobile (sm:): 1 Kolom */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onApply={handleApply}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
