// The fixed camera and the fixed light, shared by everything.
import * as THREE from "three";

export const PITCH = (38 * Math.PI) / 180; // degrees below the horizontal
export const YAW = (17 * Math.PI) / 180; // camera sits to the south-east, so south and east faces show
export const PX_PER_M = 32; // one art pixel = 1/32 m = one CSS px on a phone

/** The way the camera looks. */
export const VIEW = new THREE.Vector3(-Math.sin(YAW) * Math.cos(PITCH), -Math.sin(PITCH), -Math.cos(YAW) * Math.cos(PITCH)).normalize();
/** Screen-right and screen-up, in the world. */
export const RIGHT = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW));
export const UP = new THREE.Vector3().crossVectors(RIGHT, VIEW).normalize();
/** "Up the screen" along the ground. */
export const FWD = new THREE.Vector3(-Math.sin(YAW), 0, -Math.cos(YAW));

/** Travelling direction of the light: a weak sun low-ish in the south-west behind cloud. */
export const LIGHT = new THREE.Vector3(0.42, -1.0, -0.6).normalize();

export const STRETCH = 1 / Math.cos(PITCH); // how much taller an upright billboard must be to show at full height
