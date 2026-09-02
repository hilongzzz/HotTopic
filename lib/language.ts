/** GitHub Linguist 语言色（常用子集） */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Dart: "#00B4AB",
  Zig: "#ec915c",
  Lua: "#000080",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Scala: "#c22d40",
  "Objective-C": "#438eff",
  "Jupyter Notebook": "#DA5B0B",
  MDX: "#fcb32c",
  Nix: "#7e7eff",
  Perl: "#0298c3",
  Clojure: "#db5855",
};

export function languageColor(lang: string | null): string {
  return (lang && LANGUAGE_COLORS[lang]) || "#94a3b8";
}
