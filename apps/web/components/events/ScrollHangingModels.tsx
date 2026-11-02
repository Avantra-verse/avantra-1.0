"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ScrollHangingModels() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // SCENE SETUP
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // LIGHTING
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 1.4);
    scene.add(ambientLight);

    const cyanLight = new THREE.PointLight(0x00f2fe, 5, 20);
    cyanLight.position.set(4, 5, 5);
    scene.add(cyanLight);

    const emberLight = new THREE.PointLight(0xff5560, 4, 20);
    emberLight.position.set(-4, -2, 5);
    scene.add(emberLight);

    // ========================================================
    // BUILD MODEL 1: RETRO CYBER COMPUTER (Hangs by top cable)
    // ========================================================
    const compGroup = new THREE.Group();

    // Casing
    const caseMat = new THREE.MeshStandardMaterial({
      color: 0x1f1915,
      roughness: 0.35,
      metalness: 0.7,
    });
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 0.9), caseMat);
    compGroup.add(caseMesh);

    // CRT Screen with glowing Cyan Matrix
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x052026,
      emissive: 0x00f2fe,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.95), screenMat);
    screenMesh.position.set(0, 0.05, 0.46);
    compGroup.add(screenMesh);

    // Stand
    const standMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.3, 16), caseMat);
    standMesh.position.set(0, -0.75, 0);
    compGroup.add(standMesh);

    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.8), caseMat);
    baseMesh.position.set(0, -0.9, 0);
    compGroup.add(baseMesh);

    // Keyboard dangling slightly below
    const kbMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.6), caseMat);
    kbMesh.position.set(0, -0.88, 0.7);
    kbMesh.rotation.x = 0.15;
    compGroup.add(kbMesh);

    // Top eyelet / connector ring for the string
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x00f2fe, metalness: 0.9 });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16), ringMat);
    ring1.position.set(0, 0.72, 0);
    ring1.rotation.x = Math.PI / 2;
    compGroup.add(ring1);

    compGroup.scale.set(0.9, 0.9, 0.9);
    scene.add(compGroup);

    // ========================================================
    // BUILD MODEL 2: ELECTRIC CIRCUIT BOARD (Hangs by corner)
    // ========================================================
    const pcbGroup = new THREE.Group();

    // Emerald PCB Board
    const pcbMat = new THREE.MeshStandardMaterial({
      color: 0x0a3d2e,
      roughness: 0.2,
      metalness: 0.4,
    });
    const pcbMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 0.06), pcbMat);
    pcbGroup.add(pcbMesh);

    // Processor Chip
    const chipMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 });
    const chipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.08), chipMat);
    chipMesh.position.set(-0.35, 0, 0.04);
    pcbGroup.add(chipMesh);

    // Gold Pins
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 1 });
    for (let i = -0.8; i <= 0.8; i += 0.2) {
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.04), goldMat);
      pin.position.set(i, -0.65, 0.02);
      pcbGroup.add(pin);
    }

    // Glowing Neon Circuit Traces
    const traceMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const trace1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.8, 0.02), traceMat);
    trace1.position.set(0.3, 0.1, 0.04);
    pcbGroup.add(trace1);

    const trace2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.02), traceMat);
    trace2.position.set(0.3, 0.35, 0.04);
    pcbGroup.add(trace2);

    // Top eyelet for the string
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16), ringMat);
    ring2.position.set(0, 0.72, 0);
    ring2.rotation.x = Math.PI / 2;
    pcbGroup.add(ring2);

    pcbGroup.scale.set(0.95, 0.95, 0.95);
    scene.add(pcbGroup);

    // ========================================================
    // STRINGS / CORDS ATTACHED FROM CEILING
    // ========================================================
    // String 1 Material (Glowing cyber filament)
    const stringMat = new THREE.LineBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.8,
    });

    const string1Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 8, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    const string1 = new THREE.Line(string1Geo, stringMat);
    scene.add(string1);

    const string2Geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 8, 0),
      new THREE.Vector3(0, 0, 0),
    ]);
    const string2 = new THREE.Line(string2Geo, stringMat);
    scene.add(string2);

    // POSITIONS & SCROLL TRACKING
    // Right side on desktop, slightly tucked on smaller screens
    const getSideX = () => (window.innerWidth < 1024 ? 2.5 : 3.8);

    // Current animated Y values
    let compY = 8;
    let pcbY = 8;
    let targetCompY = 8;
    let targetPcbY = 8;
    let swayTime = 0;

    // CEILING Y in world coordinates
    const ceilingY = 7.5;

    const onScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? scrollY / docHeight : 0;

      // STAGE 1: Early scroll (Hero -> Science & Tech):
      // Computer drops down on string! (progress ~0.08 to 0.45)
      if (progress < 0.1) {
        // High above ceiling (hidden)
        targetCompY = 8.5;
        targetPcbY = 8.5;
      } else if (progress >= 0.1 && progress < 0.45) {
        // Computer dropped down hanging gracefully
        targetCompY = 0.5;
        targetPcbY = 8.5; // Circuit board still up
      } else if (progress >= 0.45 && progress < 0.85) {
        // Computer pulls up, Circuit board drops down!
        targetCompY = 8.5;
        targetPcbY = -0.3;
      } else {
        // Reached bottom: Circuit board pulls up
        targetCompY = 8.5;
        targetPcbY = 8.5;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // RENDER ANIMATION LOOP WITH PHYSICS SWAY
    let reqId: number;

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      swayTime += 0.02;

      // Smooth damped lerp for physical rope movement
      compY += (targetCompY - compY) * 0.06;
      pcbY += (targetPcbY - pcbY) * 0.06;

      const sideX = getSideX();

      // COMPUTER POSITION & NATURAL PENDULAR SWAY
      const isCompDropped = compY < 6;
      const compSway = isCompDropped ? Math.sin(swayTime * 1.5) * 0.08 : 0;
      const compRotZ = isCompDropped ? Math.sin(swayTime * 1.5) * 0.05 : 0;

      compGroup.position.set(sideX + compSway, compY, 0);
      compGroup.rotation.y = 0.35 + Math.sin(swayTime * 0.8) * 0.15;
      compGroup.rotation.z = compRotZ;

      // Update String 1 attached to top of computer
      const compAttachY = compY + 0.65;
      const string1Pos = string1.geometry.attributes.position;
      string1Pos.setXYZ(0, sideX, ceilingY, 0);
      string1Pos.setXYZ(1, sideX + compSway, compAttachY, 0);
      string1Pos.needsUpdate = true;
      string1.visible = compY < ceilingY + 0.5;

      // CIRCUIT BOARD POSITION & NATURAL PENDULAR SWAY
      // Hanging on the left side or right side with a cyber tilt
      const pcbSideX = -sideX;
      const isPcbDropped = pcbY < 6;
      const pcbSway = isPcbDropped ? Math.sin(swayTime * 1.8 + 1) * 0.08 : 0;
      const pcbRotZ = isPcbDropped ? -0.15 + Math.sin(swayTime * 1.8 + 1) * 0.06 : 0;

      pcbGroup.position.set(pcbSideX + pcbSway, pcbY, 0);
      pcbGroup.rotation.y = -0.4 + Math.sin(swayTime * 0.9) * 0.12;
      pcbGroup.rotation.z = pcbRotZ;

      // Update String 2 attached to top of circuit board
      const pcbAttachY = pcbY + 0.65;
      const string2Pos = string2.geometry.attributes.position;
      string2Pos.setXYZ(0, pcbSideX, ceilingY, 0);
      string2Pos.setXYZ(1, pcbSideX + pcbSway, pcbAttachY, 0);
      string2Pos.needsUpdate = true;
      string2.visible = pcbY < ceilingY + 0.5;

      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(reqId);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden"
      aria-hidden="true"
    />
  );
}
