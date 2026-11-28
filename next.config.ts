import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/jobs',
        destination: '/squad-d2/src/app/jobs',
      },
      {
        source: '/registration-form',
        destination: '/squad-d2/src/app/register',
      },
      {
        source: '/kanban',
        destination: '/squad-d2/src/app/kanban',
      },
      {
        source: '/fit-proper',
        destination: '/squad-d2/src/app/fit-proper',
      },
    ];
  },
};

export default nextConfig;
