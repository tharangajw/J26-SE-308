# Deploy the core product to Docker Desktop Kubernetes

This deployment is separate from the existing Docker Compose stack. It creates the four core services and their MongoDB dependencies in the `core-product` namespace so the resilience dashboard can target their Pods with Chaos Mesh.

Build the app images from the core-product repository. Docker Desktop's Kubernetes runtime must be able to access the locally built images.

```powershell
# Run from the rp-core-product repository root.
docker build -t core-product/api-gateway:local ./gateway
docker build -t core-product/book-service:local ./book-service
docker build -t core-product/order-service:local ./order-service
docker build -t core-product/user-service:local ./user-service
```

Apply the Kubernetes resources from this repository and wait for the Pods:

```powershell
# Run from the J26-SE-308 repository root.
kubectl apply -f .\k8s\core-product.yaml
kubectl get pods -n core-product -w
```

Chaos Mesh `PodFailure` swaps the selected container image with its pause image. Configure Chaos Mesh to use the pause image already present in Docker Desktop's Kubernetes runtime, and keep the application image pull policy as `IfNotPresent` so the original local image can be restored:

```powershell
kubectl set env deployment/chaos-controller-manager -n chaos-mesh POD_FAILURE_PAUSE_IMAGE=registry.k8s.io/pause:3.10
kubectl apply -f .\k8s\core-product.yaml
```

When the four application Pods show `Running`, rebuild/restart the resilience stack if the latest Chaos Mesh target-discovery code is not already running:

```powershell
docker compose up --build -d resilience-engine resilience-api frontend
```

In the dashboard, select **Chaos Mesh**. The target list uses the Kubernetes `app` labels in the manifest and only offers `api-gateway`, `book-service`, `order-service`, and `user-service`. The existing Compose services can remain running; they are separate workloads.
