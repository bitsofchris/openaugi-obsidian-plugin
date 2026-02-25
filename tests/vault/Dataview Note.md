# Notes with Dataview

This note contains a dataview query that should be stripped from output.

```dataview
TABLE file.mtime as "Modified"
FROM "/"
SORT file.mtime DESC
LIMIT 10
```

Regular content after the dataview block.

Also links to [[Linked Note A]].
