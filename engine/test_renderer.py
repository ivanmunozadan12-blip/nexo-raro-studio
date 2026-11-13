import unittest
from render_video import base_frame, draw_scene, render_frame, W, H

class RendererTests(unittest.TestCase):
    def test_all_scene_families_render(self):
        kinds=["microwave","machine","object_cutaway","illustration","interior","molecule","process","timeline","fact","map","abstract"]
        for kind in kinds:
            script={"scenes":[{"headline":"Una explicación visual","subtitle":"Prueba de composición","visual_type":kind,"narration_excerpt":"Este es un fragmento de narración de prueba.","callout":"Animación vectorial generada mediante código.","labels":["Entrada","Proceso","Resultado"],"accent":"#62d9cf","metric":{"value":"2,45 GHz","label":"Frecuencia","detail":"Dato de demostración"}}],"captions":[]}
            frame=render_frame(12,script,[0],[60])
            self.assertEqual(frame.size,(W,H),kind)
            self.assertGreater(len(frame.getdata()),0)
    def test_same_timestamp_is_deterministic(self):
        scene={"headline":"Prueba","subtitle":"Sin parpadeos","visual_type":"map","narration_excerpt":"Texto de prueba.","callout":"Mapa esquemático.","labels":["A","B","C"],"accent":"#62d9cf"}
        script={"scenes":[scene],"captions":[]}
        a=render_frame(45,script,[0],[60])
        b=render_frame(45,script,[0],[60])
        self.assertEqual(list(a.getdata()),list(b.getdata()))
    def test_caption_timeline(self):
        script={"scenes":[{"headline":"Prueba","visual_type":"fact","narration_excerpt":"Prueba de narración","metric":{"value":"42","label":"Dato"}}],"captions":[{"start":0.0,"end":2.0,"text":"Esto es una prueba"}]}
        self.assertEqual(render_frame(15,script,[0],[60]).size,(W,H))

if __name__=="__main__": unittest.main()
