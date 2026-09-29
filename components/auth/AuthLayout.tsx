import Image from "next/image";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  backgroundImage: string;
  backgroundAlt: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
};

type AuthFieldProps = {
  htmlFor: string;
  label: string;
  icon: ReactNode;
  children: ReactNode;
};

export const authInputClassName =
  "min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#151922] outline-none placeholder:text-[#7b8798] disabled:cursor-not-allowed disabled:opacity-60";

export function AuthLayout({
  backgroundImage,
  backgroundAlt,
  eyebrow,
  title,
  description,
  children,
  footer,
  wide = false,
}: AuthLayoutProps) {
  return (
    <main className="relative isolate min-h-dvh overflow-x-hidden bg-[#091225] text-[#151922]">
      <Image
        src={backgroundImage}
        alt={backgroundAlt}
        fill
        preload
        sizes="100vw"
        className="-z-30 object-cover object-center"
      />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(112deg,rgba(7,17,38,0.96)_0%,rgba(24,27,73,0.89)_45%,rgba(82,46,116,0.64)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_28%,rgba(125,104,205,0.28),transparent_38%),radial-gradient(circle_at_18%_82%,rgba(42,94,181,0.22),transparent_34%)]" />

      <section className="mx-auto grid min-h-dvh w-full max-w-[1600px] grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,680px)_minmax(280px,1fr)] lg:px-14 xl:gap-20 xl:px-20">
        <div className={`min-w-0 max-w-full ${wide ? "w-full lg:max-w-[680px]" : "w-full lg:max-w-[590px]"}`}>
          <div className="relative w-full min-w-0 overflow-hidden rounded-[30px] border border-white/70 bg-[#f8f9fc]/90 p-6 shadow-[0_28px_80px_rgba(4,8,24,0.45),inset_0_2px_5px_rgba(255,255,255,0.88)] backdrop-blur-2xl sm:rounded-[35px] sm:p-10 lg:p-12">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-40 w-4/5 -translate-x-1/2 rounded-full bg-white/70 blur-2xl" />

            <header className="relative z-10 mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#3b6ff5]">{eyebrow}</p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-[#151922] sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-[#505d6f] sm:text-[15px]">{description}</p>
            </header>

            <div className="relative z-10">{children}</div>
            <div className="relative z-10 mt-7 text-center text-sm font-medium text-[#505d6f]">{footer}</div>
          </div>
        </div>

        <aside className="hidden justify-self-end text-right text-white lg:block" aria-label="PT Andima Transportindo">
          <p className="text-sm font-semibold uppercase tracking-[0.34em] text-white/70">Human Resource Management</p>
          <p className="mt-5 text-5xl font-extrabold leading-none tracking-[-0.05em] xl:text-7xl">PT. ANDIMA</p>
          <p className="mt-3 text-xl font-semibold tracking-[0.34em] text-white/90 xl:text-3xl">TRANSPORTINDO</p>
          <div className="ml-auto mt-8 h-1 w-28 rounded-full bg-[#3b6ff5]" />
        </aside>
      </section>
    </main>
  );
}

export function AuthField({ htmlFor, label, icon, children }: AuthFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2.5 block text-sm font-semibold text-[#151922]">
        {label}
      </label>
      <div className="flex min-h-[64px] min-w-0 items-center gap-3 rounded-[28px] border border-white/80 bg-white/85 px-5 text-[#505d6f] shadow-[inset_0_3px_8px_rgba(31,42,68,0.08),0_1px_0_rgba(255,255,255,0.9)] transition focus-within:border-[#3b6ff5] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#3b6ff5]/15 sm:min-h-[70px]">
        <span className="shrink-0 text-[#3b6ff5]" aria-hidden="true">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

export function AuthNotice({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  const isError = tone === "error";

  return (
    <p
      role={isError ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold leading-5 ${
        isError
          ? "border-red-200 bg-red-50/90 text-red-700"
          : "border-blue-200 bg-blue-50/90 text-blue-800"
      }`}
    >
      {children}
    </p>
  );
}
