/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

// @flow

import { addThreadEventListeners } from "./events";
import type { TabTarget } from "./types";

export function supportsWorkers(tabTarget: TabTarget) {
  return tabTarget.isBrowsingContext || tabTarget.isContentProcess;
}

export async function updateWorkerClients({
  tabTarget,
  debuggerClient,
  threadClient,
  workerClients
}: Object) {
  if (!supportsWorkers(tabTarget)) {
    return {};
  }

  const newWorkerClients = {};

  const { workers } = await tabTarget.listWorkers();
  for (const workerTargetFront of workers) {
    await workerTargetFront.attach();
    const [, workerThread] = await workerTargetFront.attachThread();

    if (workerClients[workerThread.actor]) {
      if (workerClients[workerThread.actor].thread != workerThread) {
        throw new Error(`Multiple clients for actor ID: ${workerThread.actor}`);
      }
      newWorkerClients[workerThread.actor] = workerClients[workerThread.actor];
    } else {
      addThreadEventListeners(workerThread);
      workerThread.resume();

      const consoleFront = await tabTarget.getFront("console");
      await consoleFront.startListeners([]);

      newWorkerClients[workerThread.actor] = {
        url: workerTargetFront.url,
        thread: workerThread,
        console: consoleFront
      };
    }
  }

  return newWorkerClients;
}
