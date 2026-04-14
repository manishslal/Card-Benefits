import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

interface LegacyDashboardSettingsPageProps {
  searchParams?: Promise<SearchParams>;
}

export default async function LegacyDashboardSettingsPage({
  searchParams,
}: LegacyDashboardSettingsPageProps) {
  const resolvedSearchParams = (searchParams
    ? await searchParams
    : {}) as SearchParams;

  const query = new URLSearchParams();

  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
      return;
    }

    if (typeof value === 'string') {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  redirect(queryString ? '/settings?' + queryString : '/settings');
}
