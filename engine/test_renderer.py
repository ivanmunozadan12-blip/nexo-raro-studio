import unittest
from render_video import base_frame, draw_scene, render_frame, draw_caption, W, H
from PIL import Image

class RendererTests(unittest.TestCase):
    def test_all_scene_families_render(self):
        kinds=["microwave","machine","object_cutaway","illustration","interior","molecule","process","timeline","fact","map","abstract","aircraft","vehicle","engine","phone","turbine","industrial"]
        for kind in kinds:
            scene={"headline":"Una explicación visual","subtitle":"Prueba de composición","visual_type":kind,"narration_excerpt":"Este es un fragmento de narración de prueba.","callout":"No se debe pintar el guion completo al pie.","labels":["Entrada","Proceso","Resultado"],"accent":"#62d9cf","metric":{"value":"2,45 GHz","label":"Frecuencia","detail":"Dato de demostración"},"visual_elements":[{"shape":"gear","x":300,"y":400,"width":150,"height":150,"color":"#62d9cf","label":"rotor","motion":"rotate"},{"shape":"arrow","x":650,"y":600,"width":190,"height":80,"color":"#f3b65e","label":"flujo","motion":"flow"},{"shape":"wave","x":500,"y":750,"width":360,"height":70,"color":"#8fc7ff","label":"onda","motion":"pulse"},{"shape":"polygon","points":[[120,200],[300,100],[420,240],[220,340]],"color":"#f3b65e","label":"corte","motion":"float"},{"shape":"circle","x":750,"y":250,"width":75,"height":75,"color":"#8fc7ff","label":"nodo","motion":"pulse"},{"shape":"text","x":500,"y":900,"width":250,"height":50,"color":"#ffffff","label":"DETALLE","motion":"none"}]}
            frame=render_frame(12,{"scenes":[scene],"captions":[]},[0],[60])
            self.assertEqual(frame.size,(W,H),kind)
            self.assertGreater(len(frame.getdata()),0)
    def test_sky_scene_has_a_distinct_background(self):
        scene={"background":"sky"}
        sky=base_frame(3,"#62d9cf",scene)
        lab=base_frame(3,"#62d9cf",{"background":"dark_lab"})
        self.assertNotEqual(sky.getpixel((W//2*S,H//3*S)),lab.getpixel((W//2*S,H//3*S)))
    def test_aircraft_sky_scene_renders(self):
        scene={"headline":"La estela","subtitle":"Vapor de agua y cristales","visual_type":"aircraft","background":"sky","labels":[],"accent":"#62d9cf","visual_elements":[]}
        frame=render_frame(30,{"scenes":[scene],"captions":[]},[0],[60])
        self.assertEqual(frame.size,(W,H))
    def test_caption_is_drawn_only_during_its_cue(self):
        scene={"headline":"Prueba","visual_type":"fact","background":"clean","accent":"#62d9cf"}
        script={"scenes":[scene],"captions":[{"start":0.0,"end":2.0,"text":"Esto es una frase corta"}]}
        frame=render_frame(15,script,[0],[60])
        self.assertEqual(frame.size,(W,H))
    def test_caption_reveal_is_time_dependent(self):
        a=Image.new("RGBA",(W*2,H*2),(0,0,0,0)); b=a.copy()
        cue={"start":0.0,"end":2.0,"text":"Una frase corta"}
        draw_caption(a,cue,.1,"#62d9cf"); draw_caption(b,cue,1.7,"#62d9cf")
        self.assertNotEqual(list(a.getdata()),list(b.getdata()))
    def test_same_timestamp_is_deterministic(self):
        scene={"headline":"Prueba","subtitle":"Sin parpadeos","visual_type":"map","background":"dark_lab","narration_excerpt":"Texto de prueba.","callout":"Mapa esquemático.","labels":["A","B","C"],"accent":"#62d9cf"}
        script={"scenes":[scene],"captions":[]}
        a=render_frame(45,script,[0],[60]); b=render_frame(45,script,[0],[60])
        self.assertEqual(list(a.getdata()),list(b.getdata()))

if __name__=="__main__": unittest.main()
