import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { ExtroIcon } from '@/components/extro-icon';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2">
          <ExtroIcon size={22} />
          <span className="font-mono text-sm font-semibold tracking-tight">
            {appName.toLowerCase()}
          </span>
        </span>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
