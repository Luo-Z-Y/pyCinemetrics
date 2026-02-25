from pathlib import Path

import numpy as np

from algorithms.resultsave import resultsave
from algorithms.wordcloud2frame import WordCloud2Frame


def test_resultsave_diff_csv_and_plot(tmp_path: Path):
    rs = resultsave(str(tmp_path) + "/")
    shot_len = [[0, 10, 10], [10, 20, 10], [20, 35, 15]]

    rs.diff_csv(0, shot_len)
    rs.plot_transnet_shotcut(shot_len)

    assert (tmp_path / "shotlen.csv").exists()
    assert (tmp_path / "shotlen.png").exists()


def test_resultsave_color_outputs(tmp_path: Path):
    rs = resultsave(str(tmp_path) + "/")
    colors = [["frame0001.png", np.array(list(range(15)))] ]
    all_colors = [
        [[10, 20, 30], [40, 50, 60], [70, 80, 90], [100, 110, 120], [130, 140, 150]]
    ]

    rs.color_csv(colors)
    rs.plot_scatter_3d(all_colors)

    assert (tmp_path / "colors.csv").exists()
    assert (tmp_path / "colors.png").exists()


def test_wordcloud_output_generation(tmp_path: Path):
    wc = WordCloud2Frame()
    wc.plotwordcloud({"cinema": 10, "frame": 5}, str(tmp_path) + "/", "wordcloud")

    assert (tmp_path / "wordcloud.png").exists()
