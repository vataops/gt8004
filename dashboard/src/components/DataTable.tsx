export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = "No data",
}: DataTableProps<T>) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500">
            {columns.map((col) => (
              <th key={col.key} className="text-left p-3">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className="border-b border-gray-800/50 hover:bg-gray-800/30"
            >
              {columns.map((col) => (
                <td key={col.key} className="p-3">
                  {col.render
                    ? col.render(row)
                    : String(row[col.key] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="p-6 text-center text-gray-600"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
