export function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatFullDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function groupConversationsByDate<T extends { updatedAt: string }>(
  items: T[]
): { label: string; items: T[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const lastWeek = today - 7 * 86400000;

  const groups: Record<string, T[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    Older: [],
  };

  for (const item of items) {
    const itemTime = new Date(item.updatedAt).getTime();
    if (itemTime >= today) {
      groups.Today.push(item);
    } else if (itemTime >= yesterday) {
      groups.Yesterday.push(item);
    } else if (itemTime >= lastWeek) {
      groups['Previous 7 Days'].push(item);
    } else {
      groups.Older.push(item);
    }
  }

  return Object.entries(groups)
    .filter(([_, list]) => list.length > 0)
    .map(([label, list]) => ({ label, items: list }));
}

export function formatDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
