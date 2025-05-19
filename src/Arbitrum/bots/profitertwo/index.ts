
              // Fix: Only pass the serialized transaction array, no provider parameter
              const result = await simulateBundleWithTenderly([testTx]);
