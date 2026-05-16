# Math rendering

markviz renders math via [KaTeX](https://katex.org/) — fast, server-grade quality.

## Inline math

Wrap expressions in single dollar signs: $E = mc^2$.

The probability density of a normal distribution is $f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{1}{2}\left(\frac{x-\mu}{\sigma}\right)^2}$.

In computer science we often write $O(n \log n)$ for the cost of mergesort.

## Block math

Double dollar signs for centered display equations.

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

The Schrödinger equation:

$$
i\hbar \frac{\partial}{\partial t} \Psi(\mathbf{r}, t) = \hat{H} \Psi(\mathbf{r}, t)
$$

Fourier transform:

$$
\hat{f}(\xi) = \int_{-\infty}^{\infty} f(x)\, e^{-2\pi i x \xi} \, dx
$$

## Aligned equations

$$
\begin{aligned}
\nabla \cdot \mathbf{E} &= \frac{\rho}{\varepsilon_0} \\
\nabla \cdot \mathbf{B} &= 0 \\
\nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \\
\nabla \times \mathbf{B} &= \mu_0 \mathbf{J} + \mu_0 \varepsilon_0 \frac{\partial \mathbf{E}}{\partial t}
\end{aligned}
$$

## Matrices

$$
A = \begin{pmatrix}
a_{11} & a_{12} & a_{13} \\
a_{21} & a_{22} & a_{23} \\
a_{31} & a_{32} & a_{33}
\end{pmatrix}
$$

The determinant of a 2×2 matrix:

$$
\det\begin{pmatrix} a & b \\ c & d \end{pmatrix} = ad - bc
$$

## Cases

$$
|x| = \begin{cases}
x & \text{if } x \ge 0 \\
-x & \text{if } x < 0
\end{cases}
$$

## Big operators

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
\qquad
\prod_{i=1}^{n} i = n!
\qquad
\lim_{x \to \infty} \frac{1}{x} = 0
$$

## Calligraphic and mathbb

Sets like $\mathbb{N}, \mathbb{Z}, \mathbb{Q}, \mathbb{R}, \mathbb{C}$ render correctly, as do calligraphic letters like $\mathcal{F}, \mathcal{O}, \mathcal{L}$.
