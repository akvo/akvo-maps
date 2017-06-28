FROM akvo-base

# Install required packages

RUN apt-get update -q && \
    apt-get install -yq \
    varnish && \
    apt-get -yq clean

# Make our custom VCLs available on the container
ADD default.vcl /etc/varnish/default.vcl

ENV VARNISH_BACKEND_PORT 4000
ENV VARNISH_BACKEND_HOST akvo-tiler
ENV VARNISH_PORT 80

ADD start.sh /start.sh
CMD ["/start.sh"]
