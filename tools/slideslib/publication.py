"""Publication exclusions and reference integrity shared by builds and audits."""
from pathlib import Path
from urllib.parse import urlparse

from .html_refs import DeckParser, css_references, is_local, is_within, local_path

# Match repository-relative paths, not basenames: a talk can legitimately
# include assets/src or an application-owned notes.js.
EXCLUDED_PATHS = {
    'shared/src',
    'shared/vendor-manifest.json',
    'shared/reveal/plugin/notes.js',
}
GENERATED_DECK_ASSETS = {'slides.pdf', 'social-card.png'}


def is_excluded(relative):
    value = Path(relative).as_posix()
    return (Path(relative).name == '.gitkeep'
            or any(value == prefix or value.startswith(prefix + '/')
                   for prefix in EXCLUDED_PATHS))


def generated_export(target, root):
    try:
        parts = Path(target).relative_to(root).parts
    except ValueError:
        return False
    return (len(parts) == 3 and parts[0] == 'talks' and not parts[1].startswith('_')
            and parts[2] in GENERATED_DECK_ASSETS
            and (Path(root) / 'talks' / parts[1] / 'index.html').is_file())


def reference_errors(root, require_exports=False):
    """Yield (relative file, problem) for refs missing from the actual artifact.

    PDFs and social cards are generated in the following export stage. All
    other references must resolve already, including nested assets named src.
    """
    root = Path(root).resolve()
    for source in sorted(root.rglob('*')):
        if not source.is_file() or source.suffix not in {'.html', '.css'}:
            continue
        text = source.read_text(encoding='utf-8')
        refs = [('CSS', url) for url in css_references(text)]
        if source.suffix == '.html':
            parser = DeckParser()
            parser.feed(text)
            refs += parser.refs
        for kind, url in refs:
            if not is_local(url):
                continue
            target = local_path(str(source.parent), url, root=str(root))
            if not target:
                continue
            if not is_within(target, str(root)):
                yield source.relative_to(root).as_posix(), f'local {kind} escapes publication: {url}'
            elif not Path(target).exists() and not (
                    not require_exports and generated_export(Path(target), root)):
                yield source.relative_to(root).as_posix(), f'missing published {kind}: {url}'
