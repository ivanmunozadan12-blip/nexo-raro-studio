import json
import unittest
from pathlib import Path
from render_video import render_frame, W, H

ROOT = Path(__file__).resolve().parent
STORYBOARDS = ROOT / "storyboards"

class StoryboardTests(unittest.TestCase):
    def test_each_storyboard_matches_production_contract_and_renders(self):
        files = sorted(STORYBOARDS.glob("*.json"))
        self.assertGreaterEqual(len(files), 3)
        allowed_shapes = {"rect","rounded_rect","circle","ellipse","line","arrow","polygon","gear","wave","arc","text"}
        allowed_motion = {"none","float","pulse","rotate","flow"}
        allowed_backgrounds = {"sky","clean","workshop","ocean","nature","dark_lab"}
        allowed_sounds = {"mechanical","electric","water","impact","click","wind","whoosh"}
        for path in files:
            with self.subTest(storyboard=path.name):
                script = json.loads(path.read_text(encoding="utf-8"))
                self.assertTrue(script.get("title"))
                self.assertTrue(110 <= len(script["narration"].split()) <= 175)
                self.assertEqual(len(script["scenes"]), 8)
                self.assertGreaterEqual(len({s["visual_type"] for s in script["scenes"]}), 4)
                self.assertGreaterEqual(len(script["sources"]), 3)
                for scene in script["scenes"]:
                    self.assertIn(scene["narration_excerpt"], script["narration"])
                    self.assertIn(scene["background"], allowed_backgrounds)
                    self.assertIn(scene["sound_effect"], allowed_sounds)
                    self.assertIn(scene["camera"]["movement"], {"push_in","pull_out","pan_left","pan_right","follow","static"})
                    self.assertGreaterEqual(len(scene["visual_elements"]), 6)
                    self.assertLessEqual(len(scene["visual_elements"]), 14)
                    for element in scene["visual_elements"]:
                        self.assertIn(element["shape"], allowed_shapes)
                        self.assertIn(element["motion"], allowed_motion)
                        self.assertTrue(element["description"].strip())
                        self.assertTrue(element["role"].strip())
                    frame = render_frame(12, {"scenes":[scene], "captions":[]}, [0], [60])
                    self.assertEqual(frame.size, (W,H))
                    self.assertGreater(len(frame.getcolors(W*H) or []), 20)

if __name__ == "__main__":
    unittest.main()
