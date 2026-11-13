/** Pure function: turns an expense array into CSV text. No DOM access, easy to unit test. */
export function buildExpensesCSV(expenses) {
  const headers = ['Date', 'Category', 'Description', 'Amount']
  const rows = expenses.map((e) => [
    e.expense_date,
    e.category,
    (e.description || '').replace(/"/g, '""'),
    e.amount,
  ])

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n')
}

/** Side-effecting: triggers a browser download of the given text as a file. */
export function downloadTextFile(content, filename, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportExpensesToCSV(expenses, filename = 'expenses.csv') {
  downloadTextFile(buildExpensesCSV(expenses), filename)
}
