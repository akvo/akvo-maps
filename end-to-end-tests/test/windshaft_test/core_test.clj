(ns windshaft-test.core-test
  (:require [clj-http.client :as http]
            clj-http.conn-mgr
            clojure.stacktrace
            clojure.string
            [cheshire.core :as json]
            [clojure.test :refer [deftest testing is] :as test]
            [clojure.java.jdbc :as jdbc]
            [again.core :as again]))

(defn check-db-is-up [f]
  (again/with-retries
    (again/max-duration 60000 (again/constant-strategy 1000))
    (if (not= 1 (count (jdbc/with-db-connection
                         [conn {:connection-uri "jdbc:postgresql://postgres/test_database?user=anybody&password=password&ssl=true&sslrootcert=/pg-certs/server.crt"}]
                         (jdbc/query conn
                                     ["select * from spatial_ref_sys LIMIT 1;"]))))
      (throw (RuntimeException. "Postgres not ready"))))
  (f))

(test/use-fixtures :once check-db-is-up)

(def connection-pool (clj-http.conn-mgr/make-reusable-conn-manager {:timeout 20 :threads 100 :default-per-route 100}))

(def default-http-opts
  {:socket-timeout       10000
   :conn-timeout         10000
   :conn-request-timeout 10000
   :as :json
   :connection-manager connection-pool})

(def first-instance "http://windshaft:4000/layergroup")
(def second-instance "http://windshaft2:4000/layergroup")

(defn create-map [last-db-update]
  (http/post first-instance
             (merge default-http-opts
                    {:headers {"content-type"     "application/json"
                               "x-db-host"        "postgres"
                               "x-db-user"        "anybody"
                               "x-db-password"    "password"
                               "x-db-name"        "test_database"
                               "x-db-last-update" last-db-update
                               "x-db-port"        "5432"}
                     :body    (json/generate-string
                                {:version "1.5.0",
                                 :layers  [{:type    "mapnik",
                                            :options {:sql              "select instance, geom, yearcons::integer as yearcons from liberia where yearcons ~ '^\\d{4}$';",
                                                      :geom_column      "geom",
                                                      :srid             4326,
                                                      :cartocss         "#s { marker-width: 5; marker-fill:#f45; marker-line-color:#813; marker-allow-overlap:true; marker-fill-opacity: 0.3;} #s[yearcons>=2009] {marker-fill: #1F78B4; marker-line-color: #0000FF;}",
                                                      :cartocss_version "2.0.0",
                                                      :interactivity    "instance"}}]})})))

(deftest happy-path
         (let [last-db-update 10000
               response (create-map last-db-update)
               layer-group (-> response :body :layergroupid)]
           (clojure.test/is (= 200 (:status response)))
           (clojure.test/is (not (clojure.string/blank? layer-group)))
           (clojure.test/is (clojure.string/includes? layer-group ":1000"))

           (let [tile (http/get (str first-instance "/" layer-group "/0/0/0/0.grid.json") default-http-opts)]
             (clojure.test/is (= 200 (:status tile)))
             (clojure.test/is (= "max-age=31536000" (get-in tile [:headers "Cache-Control"]))))

           (let [png (http/get (str first-instance "/" layer-group "/10/483/493.png") (dissoc default-http-opts :as))]
             (clojure.test/is (= 200 (:status png))))))


(deftest concurrent-map-creation
  (let [concurrent-requests (doall (for [i (range 10)]
                                     (future (create-map i))))]
    (is (every? (fn [request] (= 200 (:status @request))) concurrent-requests))))

(deftest redis-caching-works
         (let [response (create-map (System/currentTimeMillis))
               layer-group (-> response :body :layergroupid)]
           (clojure.test/is (= 200 (:status response)))
           (let [tile-first-instance (http/get (str first-instance "/" layer-group "/0/11/966/990.grid.json") default-http-opts)
                 tile-second-instance (http/get (str second-instance "/" layer-group "/0/11/966/990.grid.json") default-http-opts)]
             (clojure.test/is (= (:body tile-first-instance)
                                 (:body tile-second-instance))))))

(deftest layergroup-is-consistent
  (let [now (System/currentTimeMillis)
        response-1 (create-map now)
        response-2 (create-map now)]

    (clojure.test/is (= (-> response-1 :body :layergroupid)
                        (-> response-2 :body :layergroupid)))))

(defn status-code [url]
  (try
    (:status (http/get url default-http-opts))
    (catch Exception e
      (:status (ex-data e)))))

(deftest invalid-requests
  (let [response (create-map (System/currentTimeMillis))
        layer-group (-> response :body :layergroupid)]
    (testing "Not a number"
      (test/is (= 400 (status-code (str first-instance "/" layer-group "/0/a/0/0.grid.json")))))
    (testing "Invalid layer group"
      (test/is (= 400 (status-code (str first-instance "/xxxx" layer-group "xxx/0/a/0/0.grid.json")))))
    (testing "Invalid format"
      (test/is (= 400 (status-code (str first-instance "/" layer-group "/0/0/0/0.grid_invalid.json")))))))
