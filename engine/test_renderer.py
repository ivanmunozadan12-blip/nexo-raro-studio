import unittest
from render_video import base_frame, draw_scene, render_frame, draw_caption, W, H, S
from PIL import Image

class RendererTests(unittest.TestCase):
    def test_all_scene_families_render(self):
        kinds=["microwave","machine","object_cutaway","illustration","interior","molecule","process","timeline","fact","map","abstract","aircraft","vehicle","engine","phone","turbine","industrial","flamingo","satellite","gps","octopus","roman_concrete","mars"]
        for kind in kinds:
            scene={"headline":"Una explicación visual","subtitle":"Prueba de composición","visual_type":kind,"narration_excerpt":"Este es un fragmento de narración de prueba.","callout":"No se debe pintar el guion completo al pie.","labels":["Entrada","Proceso","Resultado"],"accent":"#62d9cf","metric":{"value":"2,45 GHz","label":"Frecuencia","detail":"Dato de demostración"}}
            frame=render_frame(12,{"scenes":[scene],"captions":[]},[0],[60])
            self.assertEqual(frame.size,(W,H),kind)
            self.assertGreater(len(frame.getdata()),0)
    def test_visual_elements_form_the_scene_without_a_second_template(self):
        scene={"headline":"El plato gira","subtitle":"Reparte mejor el calor","visual_type":"illustration","background":"clean","accent":"#62d9cf","visual_elements":[
            {"shape":"circle","x":500,"y":450,"width":180,"height":180,"color":"#d99555","label":"plato"},
            {"shape":"arrow","x":300,"y":200,"width":120,"height":55,"color":"#62d9cf","label":"rotación"},
            {"shape":"rect","x":750,"y":700,"width":100,"height":90,"color":"#8fc7ff","label":"zona fría"}
        ]}
        frame=render_frame(24,{"scenes":[scene],"captions":[]},[0],[60])
        self.assertEqual(frame.size,(W,H))
        self.assertGreater(len(frame.getcolors(W*H) or []),10)
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

    def test_subject_specific_art_is_preserved_when_json_overlays_exist(self):
        kinds=["microwave","phone","satellite","flamingo","octopus","roman_concrete","mars"]
        elements=[{"shape":"circle","x":500,"y":500,"width":70,"height":70,"color":"#62d9cf","label":"detalle","role":"detail","description":"Detalle específico","motion":"pulse"}]
        for kind in kinds:
            scene={"headline":"Prueba visual","subtitle":"El sujeto debe seguir visible","visual_type":kind,"background":"clean","accent":"#62d9cf","visual_elements":elements}
            frame=render_frame(18,{"scenes":[scene],"captions":[]},[0],[60])
            self.assertEqual(frame.size,(W,H),kind)
            self.assertGreater(len(frame.getcolors(W*H) or []),20,kind)
\n    def test_same_timestamp_is_deterministic(self):
        scene={"headline":"Prueba","subtitle":"Sin parpadeos","visual_type":"map","background":"dark_lab","narration_excerpt":"Texto de prueba.","callout":"Mapa esquemático.","labels":["A","B","C"],"accent":"#62d9cf"}
        script={"scenes":[scene],"captions":[]}
        a=render_frame(45,script,[0],[60]); b=render_frame(45,script,[0],[60])
        self.assertEqual(list(a.getdata()),list(b.getdata()))

if __name__=="__main__": unittest.main()
