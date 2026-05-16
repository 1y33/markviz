# Charts — Plotly & Vega-Lite

markviz renders interactive charts inline. Use ` ```plotly ` or ` ```vega-lite ` fenced blocks with a JSON spec.

## Plotly — line chart

```plotly
{
  "data": [
    {
      "type": "scatter",
      "mode": "lines+markers",
      "x": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      "y": [2, 5, 3, 8, 7, 11, 9, 13, 12, 16],
      "name": "training loss",
      "line": {"color": "#4f8cff"}
    },
    {
      "type": "scatter",
      "mode": "lines+markers",
      "x": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      "y": [3, 6, 5, 9, 9, 12, 11, 14, 14, 17],
      "name": "val loss",
      "line": {"color": "#ff6b6b"}
    }
  ],
  "layout": {
    "title": "Loss over epochs",
    "xaxis": {"title": "epoch"},
    "yaxis": {"title": "loss"},
    "height": 380
  }
}
```

## Plotly — bar chart

```plotly
{
  "data": [{
    "type": "bar",
    "x": ["python", "rust", "go", "ts", "c++"],
    "y": [340, 95, 110, 280, 420],
    "marker": {"color": ["#4f8cff", "#ff6b6b", "#46b07c", "#bd93f9", "#88c0d0"]}
  }],
  "layout": {
    "title": "Lines of code by language",
    "height": 320
  }
}
```

## Plotly — heatmap

```plotly
{
  "data": [{
    "type": "heatmap",
    "z": [
      [1, 20, 30, 50, 1],
      [20, 1, 60, 80, 30],
      [30, 60, 1, 0, 60],
      [50, 80, 0, 1, 90],
      [1, 30, 60, 90, 1]
    ],
    "colorscale": "Viridis"
  }],
  "layout": {
    "title": "Attention scores",
    "height": 360
  }
}
```

## Vega-Lite — scatter

```vega-lite
{
  "description": "A scatter plot of car horsepower vs mpg",
  "data": {
    "values": [
      {"hp": 130, "mpg": 18},
      {"hp": 165, "mpg": 15},
      {"hp": 150, "mpg": 18},
      {"hp": 150, "mpg": 16},
      {"hp": 140, "mpg": 17},
      {"hp": 198, "mpg": 14},
      {"hp": 220, "mpg": 14},
      {"hp": 215, "mpg": 14},
      {"hp": 225, "mpg": 14},
      {"hp": 190, "mpg": 15},
      {"hp": 88, "mpg": 22},
      {"hp": 95, "mpg": 24},
      {"hp": 113, "mpg": 25},
      {"hp": 75, "mpg": 27}
    ]
  },
  "mark": "point",
  "encoding": {
    "x": {"field": "hp", "type": "quantitative", "title": "Horsepower"},
    "y": {"field": "mpg", "type": "quantitative", "title": "MPG"}
  },
  "width": 600,
  "height": 320
}
```

## Vega-Lite — bar with sort

```vega-lite
{
  "data": {
    "values": [
      {"category": "A", "count": 28},
      {"category": "B", "count": 55},
      {"category": "C", "count": 43},
      {"category": "D", "count": 91},
      {"category": "E", "count": 81},
      {"category": "F", "count": 53}
    ]
  },
  "mark": "bar",
  "encoding": {
    "x": {"field": "category", "type": "nominal", "sort": "-y"},
    "y": {"field": "count", "type": "quantitative"},
    "color": {"field": "category", "type": "nominal", "legend": null}
  },
  "width": 600,
  "height": 280
}
```

## Format for Claude

```flashcards
Q: What fenced block does markviz use for Plotly charts?
A: ` ```plotly ` with a JSON object that has `data` (array) and optionally `layout` and `config`.

Q: What fenced block does markviz use for Vega-Lite?
A: ` ```vega-lite ` with a JSON spec (the `$schema` is added automatically).

Q: When should you prefer Plotly vs Vega-Lite?
A: Plotly for 3D, contour, heatmap, and interactive financial/scientific charts. Vega-Lite for everything else — its grammar is more compact for typical statistical charts.
```
