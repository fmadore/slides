"""Phase 3 QA sweep: lint per-deck CSS and inline styles against the rules the
six Phase 2 passes established. Reports only; fixes are decided by eye."""
import io, re, glob, sys

CANVAS_UNITS = re.compile(r'(?<![\w-])(\d*\.?\d+)(vh|vw|vmin|vmax)\b')
CLAMP = re.compile(r'\bclamp\s*\(')

def strip_comments(css):
    """Blank out /* */ comments, preserving length and newlines so offsets and
    line numbers stay true."""
    out = list(css)
    for m in re.finditer(r'/\*.*?\*/', css, re.S):
        for i in range(m.start(), m.end()):
            if out[i] != '\n':
                out[i] = ' '
    return ''.join(out)


def rules_of(css, _depth=0):
    """Yield (selector, body, offset) for every rule, descending into at-rule
    blocks such as @media so nested rules are checked too."""
    if _depth == 0:
        css = strip_comments(css)
    i, sel_start = 0, 0
    while i < len(css):
        c = css[i]
        if c == '}':                       # stray close; resync
            i += 1; sel_start = i; continue
        if c != '{':
            i += 1; continue
        sel = css[sel_start:i].strip()
        body_start = i + 1
        d, j = 1, i + 1
        while j < len(css) and d:
            if css[j] == '{': d += 1
            elif css[j] == '}': d -= 1
            j += 1
        body = css[body_start:j - 1]
        if sel.startswith('@') and '{' in body:        # @media / @supports
            for r in rules_of(body, _depth + 1):
                yield r[0], r[1], body_start + r[2]
        else:
            yield sel, body, body_start
        i = j
        sel_start = i

def check(path):
    src = io.open(path, encoding='utf-8').read()
    found = []
    def add(line, rule, msg):
        found.append((line, rule, msg))

    for m in re.finditer(r'<style>(.*?)</style>', src, re.S):
        css = m.group(1)
        base = src[:m.start()].count('\n') + 1
        for sel, body, off in rules_of(css):
            line = base + css[:off].count('\n')
            decls = ' '.join(body.split())
            in_canvas = '.reveal' in sel and 'toc' not in sel and 'lightbox' not in sel \
                        and 'deck-footer' not in sel and 'deck-runhead' not in sel

            # Pass 3 — the Fixed Canvas Rule
            if in_canvas:
                for num, unit in CANVAS_UNITS.findall(body):
                    add(line, sel, 'viewport unit %s%s inside the canvas (Fixed Canvas Rule)' % (num, unit))
                if CLAMP.search(body):
                    add(line, sel, 'clamp() inside the canvas (Fixed Canvas Rule)')
                # hand-patched hero centring the theme now owns
                if 'justify-content: center' in decls and 'display: flex' in decls \
                   and re.search(r'\.(cover|section|statement|closing|metric)\b', sel):
                    add(line, sel, 'hand-patched hero centring; the theme centres heroes at .present')

            # Pass 5 / Pass 6 — named transitions only
            if re.search(r'transition:\s*all\b', decls):
                add(line, sel, 'transition: all (Focus Ring Is Not Animated Rule)')

            # Pass 5 — Ruled, Not Boxed / Overlay-Only Shadow
            if 'box-shadow' in decls and 'var(--shadow-pop)' not in decls and in_canvas \
               and not re.search(r'(lightbox|toc-|qr|chrome)', sel):
                add(line, sel, 'box-shadow on in-flow slide content (Overlay-Only Shadow Rule)')
            if re.search(r'border(-\w+)?:\s*(var\(--hair\)|1px)', decls) and 'border-radius' in decls \
               and 'var(--radius-sm)' not in decls:
                add(line, sel, 'hairline border + radius: a card where the system rules (Ruled, Not Boxed)')

            # Pass 2 — colour depths
            if re.search(r'color:\s*var\(--green\)\s*[;}]', decls) and 'background' not in decls:
                add(line, sel, 'text in raw --green; light-background text takes --green-deep')
            if re.search(r'#009260|#00268a|#cca352|#f59c08|#d57912|#44b8f2', decls, re.I):
                add(line, sel, 'raw corporate hex; use the palette token')

            # Pass 1 — the hall label tier
            for fs in re.findall(r'font-size:\s*(\d*\.?\d+)rem', body):
                if in_canvas and float(fs) < 1.0:
                    add(line, sel, 'font-size %srem inside the canvas is below the hall label tier (--fs-label 1.05rem)' % fs)

            # Pass 6 — animations must read the stiller
            if re.search(r'animation:', decls) and '--draw-run' not in decls:
                add(line, sel, 'animation that does not read var(--draw-run) — no stiller reaches it')

    # inline style attributes on slide markup
    for m in re.finditer(r'<(\w+)([^>]*?)style="([^"]*)"', src):
        line = src[:m.start()].count('\n') + 1
        decl = m.group(3)
        if CANVAS_UNITS.search(decl):
            found.append((line, '<%s inline>' % m.group(1), 'viewport unit in an inline style: %s' % decl))
        if 'justify-content' in decl and 'flex' in decl:
            found.append((line, '<%s inline>' % m.group(1), 'inline flex centring: %s' % decl))
        if 'box-shadow' in decl:
            found.append((line, '<%s inline>' % m.group(1), 'inline box-shadow: %s' % decl))

    return found

total = 0
for f in sorted(glob.glob('talks/*/index.html')):
    hits = check(f)
    if not hits:
        continue
    total += len(hits)
    print('=' * 72)
    print(f)
    print('=' * 72)
    for line, sel, msg in sorted(hits):
        print('  %s:%d  %s' % (f.replace('\\', '/'), line, msg))
        print('      %s' % (sel[:110]))
print('\nsweep: %d finding(s)' % total)
