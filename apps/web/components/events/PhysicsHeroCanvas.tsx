"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface PhysicsBody {
  mesh: THREE.Group | THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  restitution: number;
  friction: number;
  radius: number;
  groundY: number;
  isSettled: boolean;
  type: "computer" | "circuitBoard" | "quantumCore" | "microchip";
}

export default function PhysicsHeroCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gravityActive, setGravityActive] = useState(true);
  const bodiesRef = useRef<PhysicsBody[]>([]);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // SCENE SETUP
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x120e0c, 0.035);

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 400;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 2.5, 11);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // LIGHTING (Atmospheric Ember & Cyan glow)
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 1.2);
    scene.add(ambientLight);

    const cyanLight = new THREE.PointLight(0x00f2fe, 4, 25);
    cyanLight.position.set(-4, 6, 4);
    scene.add(cyanLight);

    const emberLight = new THREE.PointLight(0xff5560, 4, 25);
    emberLight.position.set(4, 5, 3);
    scene.add(emberLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(2, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // GROUND (Shadow receiver + subtle grid)
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.45 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Subtle 3D Cyber Floor Grid
    const gridHelper = new THREE.GridHelper(20, 20, 0x00f2fe, 0x332520);
    gridHelper.position.y = -2.19;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.25;
    scene.add(gridHelper);

    // ==========================================
    // 3D MODEL 1: RETRO-FUTURISTIC COMPUTER
    // ==========================================
    function createComputerModel(): THREE.Group {
      const group = new THREE.Group();

      // Monitor Casing
      const casingMat = new THREE.MeshStandardMaterial({
        color: 0x1a1512,
        roughness: 0.35,
        metalness: 0.8,
      });
      const caseGeo = new THREE.BoxGeometry(2.0, 1.6, 1.1);
      const caseMesh = new THREE.Mesh(caseGeo, casingMat);
      caseMesh.castShadow = true;
      group.add(caseMesh);

      // CRT Screen with glowing Cyan Matrix terminal
      const screenMat = new THREE.MeshStandardMaterial({
        color: 0x052026,
        emissive: 0x00f2fe,
        emissiveIntensity: 0.6,
        roughness: 0.2,
      });
      const screenGeo = new THREE.PlaneGeometry(1.6, 1.2);
      const screenMesh = new THREE.Mesh(screenGeo, screenMat);
      screenMesh.position.set(0, 0.05, 0.56);
      group.add(screenMesh);

      // Computer Stand
      const standGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.4, 16);
      const standMesh = new THREE.Mesh(standGeo, casingMat);
      standMesh.position.set(0, -0.95, 0);
      group.add(standMesh);

      const baseGeo = new THREE.BoxGeometry(1.2, 0.12, 1.0);
      const baseMesh = new THREE.Mesh(baseGeo, casingMat);
      baseMesh.position.set(0, -1.15, 0);
      baseMesh.castShadow = true;
      group.add(baseMesh);

      // Keyboard
      const kbGeo = new THREE.BoxGeometry(1.7, 0.1, 0.8);
      const kbMesh = new THREE.Mesh(kbGeo, casingMat);
      kbMesh.position.set(0, -1.12, 0.9);
      kbMesh.rotation.x = 0.1;
      kbMesh.castShadow = true;
      group.add(kbMesh);

      // Glowing Power LED
      const ledGeo = new THREE.SphereGeometry(0.04, 8, 8);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
      const ledMesh = new THREE.Mesh(ledGeo, ledMat);
      ledMesh.position.set(0.75, -0.65, 0.56);
      group.add(ledMesh);

      group.scale.set(0.9, 0.9, 0.9);
      return group;
    }

    // ==========================================
    // 3D MODEL 2: ELECTRIC CIRCUIT BOARD (PCB)
    // ==========================================
    function createCircuitBoardModel(): THREE.Group {
      const group = new THREE.Group();

      // Main PCB Substrate (Deep emerald-tech / cyber dark board)
      const pcbMat = new THREE.MeshStandardMaterial({
        color: 0x0d382d,
        roughness: 0.25,
        metalness: 0.3,
      });
      const pcbGeo = new THREE.BoxGeometry(2.4, 0.08, 1.6);
      const pcbMesh = new THREE.Mesh(pcbGeo, pcbMat);
      pcbMesh.castShadow = true;
      group.add(pcbMesh);

      // Main CPU Processor Chip
      const chipMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.9,
        roughness: 0.2,
      });
      const chipGeo = new THREE.BoxGeometry(0.7, 0.08, 0.7);
      const chipMesh = new THREE.Mesh(chipGeo, chipMat);
      chipMesh.position.set(-0.35, 0.08, 0);
      chipMesh.castShadow = true;
      group.add(chipMesh);

      // Gold pins / edge connectors
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 1.0,
        roughness: 0.2,
      });
      for (let i = -1.0; i <= 1.0; i += 0.15) {
        const pinGeo = new THREE.BoxGeometry(0.06, 0.04, 0.14);
        const pin = new THREE.Mesh(pinGeo, goldMat);
        pin.position.set(i, 0.04, -0.8);
        group.add(pin);
      }

      // Capacitors (Cylindrical micro-components)
      const capMat = new THREE.MeshStandardMaterial({
        color: 0x00f2fe,
        emissive: 0x005577,
        metalness: 0.8,
        roughness: 0.3,
      });
      const cap1Geo = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 12);
      const cap1 = new THREE.Mesh(cap1Geo, capMat);
      cap1.position.set(0.6, 0.18, -0.4);
      group.add(cap1);

      const cap2 = new THREE.Mesh(cap1Geo, capMat);
      cap2.position.set(0.85, 0.18, -0.4);
      group.add(cap2);

      // Glowing Neon Traces (Cyber Copper Lines)
      const traceMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
      const trace1Geo = new THREE.BoxGeometry(0.04, 0.01, 1.1);
      const trace1 = new THREE.Mesh(trace1Geo, traceMat);
      trace1.position.set(0.3, 0.05, 0.1);
      group.add(trace1);

      const trace2Geo = new THREE.BoxGeometry(0.9, 0.01, 0.04);
      const trace2 = new THREE.Mesh(trace2Geo, traceMat);
      trace2.position.set(0.3, 0.05, 0.4);
      group.add(trace2);

      group.scale.set(1.0, 1.0, 1.0);
      return group;
    }

    // ==========================================
    // 3D MODEL 3: QUANTUM CORE / MULTIVERSE CHIP
    // ==========================================
    function createQuantumCoreModel(): THREE.Group {
      const group = new THREE.Group();

      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xb3121e,
        emissive: 0xff5560,
        emissiveIntensity: 0.8,
        roughness: 0.1,
        metalness: 0.9,
      });
      const coreGeo = new THREE.OctahedronGeometry(0.55, 0);
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      group.add(coreMesh);

      // Outer Gyro Rings
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x9fd4ff,
        metalness: 0.9,
        roughness: 0.2,
      });
      const ring1Geo = new THREE.TorusGeometry(0.8, 0.04, 8, 32);
      const ring1 = new THREE.Mesh(ring1Geo, ringMat);
      group.add(ring1);

      const ring2 = new THREE.Mesh(ring1Geo, ringMat);
      ring2.rotation.x = Math.PI / 2;
      group.add(ring2);

      return group;
    }

    // SPAWN BODIES WITH REALISTIC PHYSICS PARAMETERS
    const bodies: PhysicsBody[] = [];

    // 1. Computer dropping from top left with rotational tumble
    const comp = createComputerModel();
    comp.position.set(-2.5, 9.5, 0.5);
    comp.rotation.set(0.4, 0.5, -0.3);
    scene.add(comp);
    bodies.push({
      mesh: comp,
      velocity: new THREE.Vector3(0.02, 0, 0),
      angularVelocity: new THREE.Vector3(0.04, 0.06, -0.05),
      restitution: 0.38, // Real physics bounce factor
      friction: 0.94,
      radius: 1.1,
      groundY: -1.0,
      isSettled: false,
      type: "computer",
    });

    // 2. Electric Circuit Board dropping from top center with aerodynamic spin
    const pcb = createCircuitBoardModel();
    pcb.position.set(1.8, 12.0, -0.2);
    pcb.rotation.set(-0.6, 0.3, 0.8);
    scene.add(pcb);
    bodies.push({
      mesh: pcb,
      velocity: new THREE.Vector3(-0.01, 0, 0),
      angularVelocity: new THREE.Vector3(-0.06, 0.05, 0.04),
      restitution: 0.44, // Light PCB bounces crisp
      friction: 0.92,
      radius: 0.9,
      groundY: -1.9,
      isSettled: false,
      type: "circuitBoard",
    });

    // 3. Quantum Multiverse Core dropping from top right
    const core = createQuantumCoreModel();
    core.position.set(3.4, 15.0, 1.0);
    scene.add(core);
    bodies.push({
      mesh: core,
      velocity: new THREE.Vector3(-0.015, 0, 0.01),
      angularVelocity: new THREE.Vector3(0.08, 0.09, 0.07),
      restitution: 0.52,
      friction: 0.95,
      radius: 0.7,
      groundY: -1.4,
      isSettled: false,
      type: "quantumCore",
    });

    bodiesRef.current = bodies;

    // PHYSICS ENGINE SIMULATION LOOP
    const gravity = -0.014; // Acceleration downward g*dt
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);

      bodies.forEach((body) => {
        // Apply Gravity
        body.velocity.y += gravity;

        // Apply Linear Velocity
        body.mesh.position.add(body.velocity);

        // Apply Angular Velocity (Tumble in 3D space)
        body.mesh.rotation.x += body.angularVelocity.x;
        body.mesh.rotation.y += body.angularVelocity.y;
        body.mesh.rotation.z += body.angularVelocity.z;

        // Ground Collision with Real Physics Bounce (Restitution)
        if (body.mesh.position.y <= body.groundY) {
          body.mesh.position.y = body.groundY;

          // Bounce with restitution
          body.velocity.y = -body.velocity.y * body.restitution;

          // Ground friction & damping
          body.velocity.x *= body.friction;
          body.velocity.z *= body.friction;
          body.angularVelocity.multiplyScalar(0.78);

          // Settle condition
          if (Math.abs(body.velocity.y) < 0.02) {
            body.velocity.y = 0;
            body.isSettled = true;
          }
        }

        // Idle micro-floating once settled for living 3D feel
        if (body.isSettled) {
          body.mesh.position.y = body.groundY + Math.sin(Date.now() * 0.002 + body.mesh.id) * 0.05;
          body.mesh.rotation.y += 0.003;
        }
      });

      // Subtle camera parallax follow
      renderer.render(scene, camera);
    };

    animate();

    // INTERACTIVE MOUSE ROTATION / PARALLAX
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / rect.width - 0.5;
      const mouseY = (e.clientY - rect.top) / rect.height - 0.5;

      camera.position.x = mouseX * 2.5;
      camera.position.y = 2.5 - mouseY * 1.5;
      camera.lookAt(0, 0, 0);
    };

    window.addEventListener("mousemove", handleMouseMove);

    // RESPONSIVE RESIZE LISTENER
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // BUTTON TO RE-DROP / DEFY GRAVITY WITH REAL PHYSICS
  const redrop = () => {
    bodiesRef.current.forEach((body, idx) => {
      body.mesh.position.y = 8 + idx * 3.5;
      body.velocity.set(
        (Math.random() - 0.5) * 0.06,
        (Math.random() - 0.3) * 0.05,
        (Math.random() - 0.5) * 0.04
      );
      body.angularVelocity.set(
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.12
      );
      body.isSettled = false;
    });
  };

  return (
    <div className="relative w-full h-[360px] sm:h-[420px] rounded-3xl overflow-hidden border border-sky/30 bg-panel/60 shadow-[0_15px_40px_rgba(0,0,0,0.6)] backdrop-blur-md">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Physics Interactive Controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-[family-name:var(--font-display)] tracking-wider uppercase bg-void/80 border border-sky/40 text-sky backdrop-blur-sm shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#00f2fe] animate-ping" />
          Interactive 3D Physics
        </span>
      </div>

      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-3">
        <button
          type="button"
          onClick={redrop}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-[family-name:var(--font-display)] bg-ember text-white border-2 border-sky hover:bg-ember-hot hover:shadow-[0_0_15px_rgba(0,242,254,0.4)] transition-all cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Re-drop 3D Models
        </button>
      </div>

      {/* Subtle Legend */}
      <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-3 text-xs text-muted">
        <span>Drag mouse to orbit</span>
        <span>•</span>
        <span>Models: Cyber Computer, Circuit PCB &amp; Core</span>
      </div>
    </div>
  );
}
