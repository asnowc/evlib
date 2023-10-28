import * as node_ps from "node:child_process";
import * as net from "node:net";
import type * as dgram from "node:dgram";

export type Handle = net.Socket | net.Server | dgram.Socket;
