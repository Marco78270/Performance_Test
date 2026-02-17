const LABEL_COLORS = ['#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#f39c12', '#e74c3c', '#2ecc71', '#34495e']

function hashStr(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function getLabelColor(label: string): string {
  return LABEL_COLORS[hashStr(label) % LABEL_COLORS.length]
}
