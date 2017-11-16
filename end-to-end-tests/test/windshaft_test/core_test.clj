(ns windshaft-test.core-test
  (:require [clj-http.client :as http]
            clj-http.conn-mgr
            clojure.stacktrace
            clojure.string
            [cheshire.core :as json]
            [clojure.test :refer [deftest] :as test]
            [clojure.java.jdbc :as jdbc]
            [again.core :as again]))

(defn check-db-is-up [f]
  (again/with-retries
    (again/max-duration 60000 (again/constant-strategy 1000))
    (if (not= 1 (count (jdbc/with-db-connection
                         [conn {:connection-uri "jdbc:postgresql://postgres/test_database?user=anybody&password=password&ssl=true"}]
                         (jdbc/query conn
                                     ["select * from spatial_ref_sys LIMIT 1;"]))))
      (throw (RuntimeException. "Postgres not ready"))))
  (f))

(test/use-fixtures :once check-db-is-up)

(def connection-pool (clj-http.conn-mgr/make-reusable-conn-manager {:timeout 20 :threads 8 :default-per-route 8}))

(def first-instance "http://windshaft:4000/layergroup")
(def second-instance "http://windshaft2:4000/layergroup")

(defn create-map [last-db-update]
  (http/post first-instance
             {:as                 :json
              :connection-manager connection-pool
              :headers            {"content-type"     "application/json"
                                   "x-db-host"        "postgres"
                                   "x-db-user"        "anybody"
                                   "x-db-password"    "password"
                                   "x-db-name"        "test_database"
                                   "x-db-last-update" last-db-update
                                   "x-db-port"        "5432"}
              :body               (json/generate-string
                                    {:version "1.5.0",
                                     :layers  [{:type    "mapnik",
                                                :options {:sql              "select instance, geom, yearcons::integer as yearcons from liberia where yearcons ~ '^\\d{4}$';",
                                                          :geom_column      "geom",
                                                          :srid             4326,
                                                          :cartocss         "#s { marker-width: 5; marker-fill:#f45; marker-line-color:#813; marker-allow-overlap:true; marker-fill-opacity: 0.3;} #s[yearcons>=2009] {marker-fill: #1F78B4; marker-line-color: #0000FF;}",
                                                          :cartocss_version "2.0.0",
                                                          :interactivity    "instance"}}]})}))

(deftest happy-path
         (let [last-db-update 10000
               response (create-map last-db-update)
               layer-group (-> response :body :layergroupid)]
           (clojure.test/is (= 200 (:status response)))
           (clojure.test/is (not (clojure.string/blank? layer-group)))
           (clojure.test/is (clojure.string/includes? layer-group ":1000"))

           (let [tile (http/get (str first-instance "/" layer-group "/0/0/0/0.grid.json") {:as :json :connection-manager connection-pool})]
             (clojure.test/is (= 200 (:status tile)))
             (clojure.test/is (= "max-age=31536000" (get-in tile [:headers "Cache-Control"]))))

           (let [png (http/get (str first-instance "/" layer-group "/10/483/493.png") {:connection-manager connection-pool})]
             (clojure.test/is (= 200 (:status png))))))

(deftest redis-caching-works
         (let [response (create-map (System/currentTimeMillis))
               layer-group (-> response :body :layergroupid)]
           (clojure.test/is (= 200 (:status response)))
           (let [tile-first-instance (http/get (str first-instance "/" layer-group "/0/11/966/990.grid.json") {:as :json :connection-manager connection-pool})
                 tile-second-instance (http/get (str second-instance "/" layer-group "/0/11/966/990.grid.json") {:as :json :connection-manager connection-pool})]
             (clojure.test/is (= (:body tile-first-instance)
                                 (:body tile-second-instance))))))

(deftest layergroup-is-consistent
  (let [now (System/currentTimeMillis)
        response-1 (create-map now)
        response-2 (create-map now)]

    (clojure.test/is (= (-> response-1 :body :layergroupid)
                        (-> response-2 :body :layergroupid)))))


