// CUDA: SAXPY (Single-precision A*X Plus Y).
// markviz highlights .cu/.cuh files using the C++ grammar.

#include <cuda_runtime.h>
#include <cstdio>

__global__ void saxpy(int n, float a, const float* __restrict__ x, float* __restrict__ y) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) {
        y[i] = a * x[i] + y[i];
    }
}

int main() {
    const int N = 1 << 20;
    const size_t bytes = N * sizeof(float);

    float *h_x = new float[N];
    float *h_y = new float[N];
    for (int i = 0; i < N; ++i) { h_x[i] = 1.0f; h_y[i] = 2.0f; }

    float *d_x, *d_y;
    cudaMalloc(&d_x, bytes);
    cudaMalloc(&d_y, bytes);
    cudaMemcpy(d_x, h_x, bytes, cudaMemcpyHostToDevice);
    cudaMemcpy(d_y, h_y, bytes, cudaMemcpyHostToDevice);

    const int block = 256;
    const int grid  = (N + block - 1) / block;
    saxpy<<<grid, block>>>(N, 2.0f, d_x, d_y);

    cudaDeviceSynchronize();
    cudaMemcpy(h_y, d_y, bytes, cudaMemcpyDeviceToHost);

    float max_err = 0.0f;
    for (int i = 0; i < N; ++i) max_err = fmaxf(max_err, fabsf(h_y[i] - 4.0f));
    printf("max error = %f\n", max_err);

    cudaFree(d_x); cudaFree(d_y);
    delete[] h_x; delete[] h_y;
    return 0;
}
